import { serve } from "@hono/node-server";
import { createContainer } from "./infrastructure/composition/container";
import { loadConfig } from "./infrastructure/config";
import { createNodeStorage } from "./infrastructure/storage/create-node-storage";
import { createApp } from "./interfaces/http/app";
import { sentry } from "@sentry/hono/node";
import * as Sentry from "@sentry/node";
import { initializeNodeObservability } from "./infrastructure/observability/node";
import {
  registerAiTelemetry,
  setRuntimeName,
} from "./infrastructure/observability";

const config = loadConfig(process.env);
setRuntimeName("node");
initializeNodeObservability(config.observability);
registerAiTelemetry();
const container = createContainer(config, createNodeStorage(config.storage));
const app = createApp(container, {
  runtime: "node",
  instrument: (hono) => hono.use("*", sentry(hono)),
  setRequestContext: ({ requestId }) => {
    Sentry.setTag("request.id", requestId);
  },
});
const port = Number(process.env.PORT ?? 8780);

serve({ fetch: app.fetch, port }, (info) => {
    console.log(`API listening on http://localhost:${info.port}`);
});
