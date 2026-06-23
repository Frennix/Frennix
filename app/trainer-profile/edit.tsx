import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getMyTrainerProfile } from "@frennix/api";
import { TrainerProfileEditor } from "@/components/TrainerProfileEditor";
import { DetailLoading } from "@/components/DetailLoading";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, colors } from "@frennix/ui";
import { pushScreen } from "@/lib/press-utils";

export default function TrainerEditScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["my-trainer-profile", userId],
    queryFn: getMyTrainerProfile,
    enabled: !!userId,
  });

  if (isLoading) return <DetailLoading />;

  if (!bundle) {
    return (
      <EmptyState
        title="No trainer profile yet"
        description="Set up your trainer profile to start receiving coaching requests."
        actionLabel="Become a trainer"
        onAction={() => pushScreen("/trainer-profile/setup")}
      />
    );
  }

  return (
    <View style={styles.container}>
      <TrainerProfileEditor userId={userId} initial={bundle} showDiscoveryToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
