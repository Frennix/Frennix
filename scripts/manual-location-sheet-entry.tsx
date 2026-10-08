import { AppRegistry } from "react-native";
import { ManualLocationSheetHarness } from "./manual-location-sheet-harness";

AppRegistry.registerComponent("main", () => ManualLocationSheetHarness);

if (typeof document !== "undefined") {
  const rootTag = document.getElementById("root");
  if (rootTag) {
    AppRegistry.runApplication("main", { rootTag });
  }
}
