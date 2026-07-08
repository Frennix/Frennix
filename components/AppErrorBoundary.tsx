import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { pushScreen } from "@/lib/press-utils";
import { reportClientError } from "@/lib/report-client-error";

const FRIENDLY_CRASH_MESSAGE =
  "Something went wrong while loading Frennix. Please try again.";

interface Props {
  children: ReactNode;
  scope?: string;
  userId?: string;
  email?: string;
  screen?: string;
}

interface State {
  error: Error | null;
  resetKey: number;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const scope = this.props.scope ?? "app";
    console.error(`[error-boundary:${scope}]`, error, info.componentStack);
    void reportClientError({
      source: `error-boundary:${scope}`,
      error,
      componentStack: info.componentStack,
      userId: this.props.userId,
      email: this.props.email,
      screen: this.props.screen ?? scope,
    });
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;

    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{FRIENDLY_CRASH_MESSAGE}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry"
              onPress={this.handleRetry}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open diagnostics"
              onPress={() => pushScreen("/beta-diagnostics")}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.secondaryButtonText}>Diagnostics</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return <View key={resetKey} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: {
    ...flexFill,
    backgroundColor: colors.background,
    ...(Platform.OS === "web" ? webAppShell : null),
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
