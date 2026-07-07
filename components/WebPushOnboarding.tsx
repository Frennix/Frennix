import { WebPushEnableCard } from "./WebPushEnableCard";

/** @deprecated Use WebPushEnableCard */
export function WebPushOnboarding(props: { readyForPush?: boolean }) {
  return <WebPushEnableCard readyForPush={props.readyForPush} />;
}
