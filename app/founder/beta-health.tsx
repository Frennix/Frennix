import { Redirect } from "expo-router";

/** Legacy alias — Beta Health merged into Operations dashboard. */
export default function BetaHealthRedirect() {
  return <Redirect href="/founder/operations" />;
}
