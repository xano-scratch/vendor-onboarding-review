import { f, table } from "@xano/sdk";

// table "account" — generated from a Xano bundle.
export const account = table({
  name: "account",
  guid: "f2f78af06c7c59b550823db5edae97bc",
  description: "Stores information about accounts that users belong to",
  schema: {
    id: f.int({
      required: true,
    }),
    created_at: f.timestamp({
      default: "now",
      access: "private",
    }),
    name: f.text({
      description: "The name of the company.",
      methods: [
        "trim",
      ],
    }),
    description: f.text({
      description: "A brief description of the company.",
      methods: [
        "trim",
      ],
    }),
    location: f.text({
      methods: [
        "trim",
      ],
    }),
  },
  useXdo: true,
  tags: [
    "xano:quick-start",
  ],
});
