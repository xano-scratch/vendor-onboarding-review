import { c, defineFunction, inp, input, s } from "@xano/sdk";
import { event_log } from "./table/event_log.js";

// function "Getting Started Template/create_event_log" — generated from a Xano bundle.
export const Getting_Started_Template_create_event_log = defineFunction({
  name: "Getting Started Template/create_event_log",
  guid: "19bb274c20b194d7fa03ca4bafb3ac4c",
  description: "Creates a record in the event log table",
  tags: [
    "xano:quick-start",
  ],
  input: {
    user_id: input.int({
      required: true,
      description: "Unique identifier for the user who performed the action.",
    }),
    account_id: input.int({
      required: true,
      description: "Unique identifier for the account associated with the event.",
    }),
    action: input.text({
      required: true,
      description: "A description of the action performed by the user (e.g., 'login', 'created_invoice').",
    }),
    metadata: input.json({
      description: "Additional data related to the event, such as resource IDs or old/new values.",
    }),
  },
  response: c.null(),
  stack: [
    s.db.add({
      table: event_log,
      data: [
        {
          name: "created_at",
          value: c.text("now"),
        },
        {
          name: "user_id",
          value: inp("user_id"),
        },
        {
          name: "account_id",
          value: inp("account_id"),
        },
        {
          name: "action",
          value: inp("action"),
        },
        {
          name: "metadata",
          value: inp("metadata"),
        },
      ],
      as: "new_log_entry",
    }),
  ],
});
