// The base app's endpoints, typed from the defs (import type only) with paths from xano/routes.gen.ts.
import type { InferResponse } from "@xano/sdk";
import type { demoPersonas } from "../../../xano/query/authentication/demo.js";
import type { checkLink, createInvite, createResetLink, listInvites } from "../../../xano/query/authentication/links.js";
import type { getSettings, listActivity, listNotifications, listPeople } from "../../../xano/base/queries.js";
import { routePath } from "../../../xano/routes.gen.js";
import { qs, request } from "./request";

export type Persona = InferResponse<typeof demoPersonas>[number];
export type Me = { id: number; name: string; email: string; role: string; created_at?: number };
export type Settings = InferResponse<typeof getSettings>;
export type NotificationPage = InferResponse<typeof listNotifications>;
export type Notification = NotificationPage["items"][number];
export type ActivityPage = InferResponse<typeof listActivity>;
export type Activity = ActivityPage["items"][number];
export type Person = InferResponse<typeof listPeople>[number];
export type Invite = InferResponse<typeof listInvites>[number];
export type NewInvite = InferResponse<typeof createInvite>;
export type ResetLink = InferResponse<typeof createResetLink>;
export type LinkInfo = InferResponse<typeof checkLink>;

export const baseApi = {
  personas: () => request<Persona[]>("GET", routePath("GET auth/demo/personas")),
  demo: (persona: string) => request<{ authToken: string }>("POST", routePath("POST auth/demo"), { persona }),
  login: (email: string, password: string) => request<{ authToken: string }>("POST", routePath("POST auth/login"), { email, password }),
  signup: (name: string, email: string, password: string) => request<{ authToken: string }>("POST", routePath("POST auth/signup"), { name, email, password }),
  me: () => request<Me>("GET", routePath("GET auth/me")),
  updateMe: (name: string) => request<Me>("PATCH", routePath("PATCH auth/me"), { name }),
  changePassword: (current_password: string, new_password: string) => request<{ changed: boolean }>("POST", routePath("POST auth/me/password"), { current_password, new_password }),

  settings: () => request<Settings>("GET", routePath("GET app/settings")),
  updateSettings: (s: { name: string; timezone: string; week_start: "monday" | "sunday" }) => request<Settings>("PATCH", routePath("PATCH app/settings"), s),
  people: () => request<Person[]>("GET", routePath("GET app/people")),

  notifications: (q: { unread?: boolean; page?: number } = {}) => request<NotificationPage>("GET", routePath("GET app/notifications") + qs(q)),
  unread: () => request<{ count: number }>("GET", routePath("GET app/notifications/unread")),
  readNotification: (id: number) => request<unknown>("POST", routePath("POST app/notifications/{id}/read", { id })),
  readAll: () => request<unknown>("POST", routePath("POST app/notifications/read-all")),

  activity: (q: { entity?: string; entity_id?: number; page?: number; per_page?: number } = {}) => request<ActivityPage>("GET", routePath("GET app/activity") + qs(q)),

  invites: () => request<Invite[]>("GET", routePath("GET auth/invites")),
  invite: (email: string, name: string, role: string) => request<NewInvite>("POST", routePath("POST auth/invites"), { email, name, role }),
  revokeInvite: (id: number) => request<unknown>("POST", routePath("POST auth/invites/{id}/revoke", { id })),
  resetLink: (id: number) => request<ResetLink>("POST", routePath("POST auth/people/{id}/reset-link", { id })),
  checkLink: (token: string) => request<LinkInfo>("POST", routePath("POST auth/link"), { token }),
  acceptLink: (token: string, password: string, name?: string) => request<{ authToken: string }>("POST", routePath("POST auth/link/accept"), { token, password, name }),
};

/** The page a one-time link opens: /join/<token>. Shown once, so the person copies it then. */
export const joinUrl = (t: string) => `${location.origin}/join/${encodeURIComponent(t)}`;
