import * as Sentry from "@sentry/node";
import type { ObservabilityConfig } from "../config";
import { sanitizeSpan, setErrorReporter } from "./core";

export function initializeNodeObservability(config: ObservabilityConfig): void {
  if (!config.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
    enableLogs: true,
    tracesSampler: ({ name }) => {
      if (name.includes("/health")) return 0;
      if (/\/api\/trips\/[^/]+\/agent\//.test(name)) return 1;
      return 0.1;
    },
    beforeSendSpan: (span) => sanitizeSpan(span),
    beforeSend: (event) => {
      if (event.request) {
        delete event.request.headers;
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.url) event.request.url = event.request.url.split("?")[0];
      }
      return event;
    },
  });
  setErrorReporter((error, fields) => {
    Sentry.withScope((scope) => {
      if (fields) scope.setContext("opentrip", fields);
      Sentry.captureException(error);
    });
  });
}
