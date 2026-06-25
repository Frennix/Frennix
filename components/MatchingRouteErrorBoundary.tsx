import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { EmptyState, colors } from "@frennix/ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: number;
}

/** Keeps /matching on an empty state instead of the root "Something went wrong" screen. */
export class MatchingRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[error-boundary:matching]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;

    if (error) {
      return (
        <View style={styles.container}>
          <EmptyState
            title="Could not load partners"
            description="Training partner discovery hit an unexpected error. You can try again or update your preferences."
            actionLabel="Try again"
            onAction={this.handleRetry}
          />
        </View>
      );
    }

    return <View key={resetKey} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
  },
});
