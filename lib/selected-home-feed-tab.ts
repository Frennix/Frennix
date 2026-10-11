import type { HomeFeedTab } from "@frennix/types";

let selectedHomeFeedTab: HomeFeedTab = "all";

/** Home keeps the selected tab. The bottom Post button reads it from outside that screen. */
export function setSelectedHomeFeedTab(tab: HomeFeedTab) {
  selectedHomeFeedTab = tab;
}

export function getSelectedHomeFeedTab(): HomeFeedTab {
  return selectedHomeFeedTab;
}
