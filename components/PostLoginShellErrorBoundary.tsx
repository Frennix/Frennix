import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { webAppShell } from "@/lib/flex-layout";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  resetKey: number;
}

/** Catches post-login shell failures with user-friendly copy (technical detail logged only). */
export class PostLoginShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error(`[post-login-shell:${this.props.label ?? "shell"}]`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      error: null,
      componentStack: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    const { error, componentStack, resetKey } = this.state;

    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.label}>
            Frennix hit a problem loading this screen. Your account is safe — try again.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return <View key={resetKey} pointerEvents="box-none" style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: { ...{ flex: 1, minHeight: 0, backgroundColor: "#0A0A0B" }, ...webAppShell },
  container: {
    flex: 1,
    backgroundColor: "#1a0000",
    paddingTop: Platform.OS === "web" ? 120 : 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  title: {
    color: "#ffea00",
    fontSize: 20,
    fontWeight: "900",
  },
  label: {
    color: "#ffb4b4",
    fontSize: 13,
    fontWeight: "700",
  },
  scroll: { flex: 1 },
  scrollContent: { gap: 8, paddingBottom: 16 },
  errorName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  errorMessage: { color: "#fff", fontSize: 15, lineHeight: 22 },
  stack: {
    color: "#ccc",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#ffea00",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: "#1a0000", fontWeight: "800", fontSize: 15 },
});
