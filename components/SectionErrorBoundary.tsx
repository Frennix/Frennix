import { Component, type ErrorInfo, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { reportClientError } from "@/lib/report-client-error";
import { StartupDiagnosticPanel } from "@/components/StartupDiagnosticPanel";

type Props = {
  children: ReactNode;
  label: string;
  screen?: string;
  userId?: string;
  email?: string;
  /** When true, show compact inline retry instead of tall panel. */
  compact?: boolean;
};

type State = {
  error: Error | null;
  componentStack: string | null;
  resetKey: number;
};

/** Isolates a screen/section so one failure does not lock the whole app. */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    logDiagnostic(this.props.label, error.message, "error", {
      stack: error.stack,
      componentStack: info.componentStack,
    });
    void reportClientError({
      source: `section:${this.props.label}`,
      error,
      componentStack: info.componentStack,
      userId: this.props.userId,
      email: this.props.email,
      screen: this.props.screen ?? this.props.label,
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
    const { error, componentStack, resetKey } = this.state;

    if (error) {
      return (
        <View style={[styles.container, this.props.compact && styles.containerCompact]}>
          <Text style={styles.title}>This section could not load</Text>
          <Text style={styles.body}>
            The rest of Frennix is still available. Try again, or send diagnostics if this keeps
            happening.
          </Text>
          <Text style={styles.errorDetail} numberOfLines={8}>
            {error.message}
          </Text>
          {__DEV__ && componentStack ? (
            <Text style={styles.devDetail} numberOfLines={6}>
              {componentStack}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={this.handleRetry}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
          <StartupDiagnosticPanel
            source={`section:${this.props.label}`}
            reason={error.message}
            screen={this.props.screen ?? this.props.label}
          />
        </View>
      );
    }

    return (
      <View key={resetKey} style={this.props.compact ? styles.compactWrap : styles.flex}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  compactWrap: { flexGrow: 0, flexShrink: 0, alignSelf: "stretch" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  containerCompact: {
    justifyContent: "flex-start",
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.body,
    fontWeight: "800",
    color: colors.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  errorDetail: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 18,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  devDetail: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
});
