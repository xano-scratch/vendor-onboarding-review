// The whole app, from one config. Edit frontend/src/app.config.tsx and the screens in pages/, not this file.
import { createApp } from "@/base/app";
import { config } from "./app.config";

export default createApp(config);
