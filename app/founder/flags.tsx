import { FounderComingSoon } from "@/components/founder/FounderComingSoon";

export default function FounderFlagsScreen() {
  return (
    <FounderComingSoon
      title="Feature Flags"
      milestone="M7.5"
      description="Enable or disable major features without redeploying. Supports staged rollouts and cohort overrides."
    />
  );
}
