import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { webAppShell } from "@/lib/flex-layout";
import { pushScreen } from "@/lib/press-utils";
import { reportClientError } from "@/lib/report-client-error";

interface Props {
  children: ReactNode;
  label?: string;
  userId?: string;
  email?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  resetKey: number;
}

/** Catches prompt/bootstrap failures without blocking tab navigation. */
export class PostLoginShellErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error(`[post-login-shell:${this.props.label ?? "shell"}]`, error, info.componentStack);
    void reportClientError({
      source: `post-login-shell:${this.props.label ?? "shell"}`,
      error,
      componentStack: info.componentStack,
      userId: this.props.userId,
      email: this.props.email,
      screen: this.props.label ?? "post-login-shell",
    });
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      error: null,
      componentStack: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    const { error, resetKey } = this.state;

    if (error) {
      return (
        <View style={styles.flex}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>A startup prompt failed to load</Text>
            <Text style={styles.bannerBody}>
              Frennix will keep working — only an optional prompt was affected.
            </Text>
            <View style={styles.bannerActions}>
              <Pressable style={styles.button} onPress={this.handleRetry}>
                <Text style={styles.buttonText}>Retry prompt</Text>
              </Pressable>
              <Pressable style={styles.linkButton} onPress={() => pushScreen("/beta-diagnostics")}>
                <Text style={styles.linkButtonText}>Diagnostics</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View key={resetKey} pointerEvents="box-none" style={styles.flex}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { ...{ flex: 1, minHeight: 0, backgroundColor: "#0A0A0B" }, ...webAppShell },
  banner: {
    backgroundColor: "#1a0000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#3f1d1d",
  },
  bannerTitle: {
    color: "#ffea00",
    fontSize: 14,
    fontWeight: "800",
  },
  bannerBody: {
    color: "#ffb4b4",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#ffea00",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: { color: "#1a0000", fontWeight: "800", fontSize: 13 },
  linkButton: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  linkButtonText: {
    color: "#ffb4b4",
    fontWeight: "700",
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
