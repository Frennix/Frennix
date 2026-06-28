import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  resetKey: number;
}

/** Shows the real error on-screen after login — avoids blank white failures. */
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
          <Text style={styles.title}>Post-login shell error</Text>
          <Text style={styles.label}>{this.props.label ?? "tabs/feed shell"}</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.errorName}>{error.name}</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            {error.stack ? <Text style={styles.stack}>{error.stack}</Text> : null}
            {componentStack ? (
              <Text style={styles.stack}>Component stack:{componentStack}</Text>
            ) : null}
          </ScrollView>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Retry shell</Text>
          </Pressable>
        </View>
      );
    }

    return <View key={resetKey} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0, backgroundColor: "#0A0A0B" },
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
