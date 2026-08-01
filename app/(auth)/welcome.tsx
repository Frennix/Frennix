import { Redirect } from "expo-router";

/** Legacy route — logged-out users land on login directly. */
export default function WelcomeScreen() {
  return <Redirect href="/(auth)/login" />;
}
