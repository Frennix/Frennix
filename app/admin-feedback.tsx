import { Redirect } from "expo-router";

/** Legacy route — all feedback lives in Founder Dashboard. */
export default function AdminFeedbackRedirect() {
  return <Redirect href="/founder/support" />;
}
