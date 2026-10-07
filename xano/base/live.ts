// Realtime: one server, three channels (BASELINE.md "Live"). Verified on the local engine (v0.1.19): the person's
// auth token is the websocket subprotocol, anonymous sockets are refused, and a person can join only their own
// users/{id} channel. Pushes come from app/changed and app/notify, which every write path calls.
//
// Why a function call and not a table trigger: on the local engine a `tableTrigger` runs but its
// `s.realtime.publish` never reaches a socket, while the same publish from an endpoint's stack (directly or
// through `s.function.run`) does. So writes call `changed(...)` (functions.ts), and audit-bundle.mjs checks
// that every endpoint and tool that writes a domain table does.
import { c, input, realtimeChannel, realtimeChannelTrigger, realtimeServer, s } from "@xano/sdk";

/** The one realtime server. `enabled: true` is required: it's the one `enabled` in the SDK that defaults to false. */
export const live = realtimeServer({ name: "live", canonical: "live", enabled: true, description: "Live updates for the app's screens." });

/**
 * Everyone signed in: "row N of <entity> changed" (ids only, never row data: each screen refetches what its
 * person may see), plus presence, so the header can show who's here.
 */
export const appChannel = realtimeChannel({ name: "app", server: live, presence: true, description: "Changes to shared records, and who is online." });

/** One person's own channel: their notifications, the moment they're written. */
export const userChannel = realtimeChannel({
  name: "users/{user_id}", server: live, input: { user_id: input.int() },
  description: "A person's notifications. Only that person can join.",
});

/** Who else is looking at a record (`rooms/job-12`): presence only, nothing is sent here. */
export const roomChannel = realtimeChannel({
  name: "rooms/{room}", server: live, input: { room: input.text() }, presence: true,
  description: "Who is viewing a record or a board right now.",
});

/**
 * Only you join users/{you}. A join trigger has no auth() and no inputs: identity is the session's client_id
 * (the auth row id, as text) and the path param is session.params. An empty or falsy answer refuses.
 */
export const userChannelJoin = realtimeChannelTrigger({
  name: "live/users_join", channel: userChannel, actions: { join: true },
  description: "Admit a person to their own notification channel only.",
  stack: [s.realtime.get_session({ as: "session" })],
  response: { allowed: c.expression('$var.session.authenticated == true && ($var.session.client_id|to_text) == ($var.session.params.user_id|to_text)') },
});

export const liveServers = [live];
export const liveChannels = [appChannel, userChannel, roomChannel];
export const liveTriggers = [userChannelJoin];
