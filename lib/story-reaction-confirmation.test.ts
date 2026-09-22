import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyVisibleReactionConfirmation,
  clearVisibleReactionConfirmation,
  REACTION_SENT_MESSAGE,
  shouldAcceptReactionConfirmation,
} from "./story-reaction-confirmation";
import {
  applyStoryReactionConfirmedFromServer,
  applyStoryReactionSuccess,
  applyStoryReactionTap,
  createStoryReactionSelection,
} from "./story-reaction-selection";

describe("visible reaction confirmation", () => {
  it("keeps Reaction sent visible after a stale previous-emoji sync", () => {
    let state = createStoryReactionSelection("🔥");
    const tap = applyStoryReactionTap(state, "❤️");
    state = applyStoryReactionSuccess(tap.state, tap.requestId, "❤️");
    assert.equal(state.status, "sent");
    assert.equal(state.confirmed, "❤️");

    state = applyStoryReactionConfirmedFromServer(state, "🔥");
    assert.equal(state.status, "sent");
    assert.equal(state.confirmed, "❤️");
    assert.equal(state.selected, "❤️");
  });

  it("ignores an older confirmation timeout so the latest toast stays", () => {
    const first = applyVisibleReactionConfirmation(null, {
      requestId: 1,
      message: REACTION_SENT_MESSAGE,
    });
    const latest = applyVisibleReactionConfirmation(first, {
      requestId: 2,
      message: REACTION_SENT_MESSAGE,
    });
    assert.equal(latest?.requestId, 2);
    assert.equal(clearVisibleReactionConfirmation(latest, 1)?.requestId, 2);
    assert.equal(clearVisibleReactionConfirmation(latest, 2), null);
    assert.equal(shouldAcceptReactionConfirmation(2, 1), false);
    assert.equal(shouldAcceptReactionConfirmation(2, 2), true);
  });
});
