import { f, table } from "@xano/sdk";
import { DEMO_PASSWORD, DEMO_PEOPLE, ROLES } from "../app.js";
import { account } from "./account.js";

// table "user" — generated from a Xano bundle.
export const user = table({
  name: "user",
  guid: "efb558104909137dac95907814c26051",
  description: "Stores user information and allows the user to authenticate  against",
  auth: true,
  schema: {
    id: f.int({
      required: true,
    }),
    created_at: f.timestamp({
      default: "now",
      access: "private",
    }),
    name: f.text({
      required: true,
      methods: [
        "trim",
      ],
    }),
    email: f.email({
      nullable: true,
      required: true,
      methods: [
        "trim",
        "lower",
      ],
    }),
    password: f.password({
      nullable: true,
      required: true,
      methods: [
        "min:8",
        "minAlpha:1",
        "minDigit:1",
      ],
    }),
    account_id: f.tableRef(account, {
      description: "Reference to the company the user belongs to.",
    }),
    role: f.enum([...ROLES], {
      description: "The role of the user within their company (e.g., 'admin', 'member').",
    }),
    password_reset: f.object({
      token: f.password(),
      expiration: f.timestamp({
        nullable: true,
      }),
      used: f.bool(),
    }),
  },
  index: [
    {
      type: "btree|unique",
      fields: [
        {
          name: "email",
          op: "asc",
        },
      ],
    },
  ],
  tags: [
    "xano:quick-start",
  ],
  // The demo people (xano/app.ts), in order: other tables refer to them by position (user_id: 1 is the first).
  publicSeed: ["password"],
  seed: DEMO_PEOPLE.map((p) => ({ name: p.name, email: p.email, password: DEMO_PASSWORD, role: p.role })),
});
