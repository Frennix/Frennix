import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform } from "react-native";
import { reportClientError } from "@/lib/report-client-error";
import {
  recordWebStartupCheckpoint,
  redactUserId,
  setWebStartupFailureCategory,
} from "@/lib/web-startup-checkpoints";
import { WebAuthenticatedStartupFallback } from "@/components/WebAuthenticatedStartupFallback";

type Props = {
  children: ReactNode;
  userId?: string;
  email?: string;
  onRetry: () => void;
  onSignOut: () => void;
};

type State = {
  error: Error | null;
};

/** Catches authenticated web render errors after login. */
export class WebAuthenticatedErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    setWebStartupFailureCategory("render", error.message);
    recordWebStartupCheckpoint("startup:render-error", {
      message: error.message.slice(0, 160),
      userId: redactUserId(this.props.userId),
    });
    void reportClientError({
      source: "web-authenticated-error-boundary",
      error,
      componentStack: info.componentStack,
      userId: this.props.userId,
      email: this.props.email,
      screen: typeof location !== "undefined" ? location.pathname : "web",
    });
  }

  render() {
    if (Platform.OS !== "web") return this.props.children;
    if (!this.state.error) return this.props.children;

    return (
      <WebAuthenticatedStartupFallback
        category="render"
        onRetry={() => {
          this.setState({ error: null });
          this.props.onRetry();
        }}
        onSignOut={this.props.onSignOut}
      />
    );
  }
}
