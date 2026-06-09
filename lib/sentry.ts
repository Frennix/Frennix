import * as Sentry from "@sentry/react-native";
import { config } from "./config";

export function initSentry() {
  if (!config.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    tracesSampleRate: 0.2,
    enableInExpoDevelopment: false,
  });
}

export { Sentry };
