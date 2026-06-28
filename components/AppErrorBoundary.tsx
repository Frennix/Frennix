import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@frennix/ui";
import { flexFill } from "@/lib/flex-layout";

interface Props {
  children: ReactNode;
  /** Optional label for error reporting context. */
  scope?: string;
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
          <Text style={styles.message}>
            Frennix hit an unexpected error. Tap retry to restore the screen.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={this.handleRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return <View key={resetKey} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: flexFill,
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
  button: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
