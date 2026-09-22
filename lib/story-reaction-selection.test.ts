import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STORY_QUICK_REACTIONS } from "../packages/types/src/workout-story";
import {
  applyStoryReactionConfirmedFromServer,
  applyStoryReactionFailure,
  applyStoryReactionSuccess,
  applyStoryReactionTap,
  createStoryReactionSelection,
  displayedStoryReactionValues,
  REACTION_DELIVER_ERROR,
  selectedStoryReactions,
} from "./story-reaction-selection";

describe("story reaction latest-tap-wins", () => {
  it("highlights exactly one emoji after a rapid tap sequence", () => {
    let state = createStoryReactionSelection("❤️");
    const first = applyStoryReactionTap(state, "🔥");
    state = first.state;
    const second = applyStoryReactionTap(state, "😂");
    state = second.state;
    const third = applyStoryReactionTap(state, "👀");
    state = third.state;

    assert.deepEqual(selectedStoryReactions(state), ["👀"]);
    assert.equal(state.confirmed, "❤️");
    assert.equal(state.status, "pending");
    assert.equal(third.requestId, 3);
    assert.equal(first.requestId < second.requestId && second.requestId < third.requestId, true);
  });

  it("clears the previous optimistic highlight before selecting the new emoji", () => {
    let state = createStoryReactionSelection(null);
    state = applyStoryReactionTap(state, "🔥").state;
    assert.deepEqual(selectedStoryReactions(state), ["🔥"]);
    state = applyStoryReactionTap(state, "👏").state;
    assert.deepEqual(selectedStoryReactions(state), ["👏"]);
    assert.equal(state.selected === "🔥", false);
  });

  it("ignores an older success so it cannot overwrite the latest selection", () => {
    let state = createStoryReactionSelection(null);
    const first = applyStoryReactionTap(state, "🔥");
    state = first.state;
    const second = applyStoryReactionTap(state, "😂");
    state = second.state;

    state = applyStoryReactionSuccess(state, first.requestId, "🔥");
    assert.deepEqual(selectedStoryReactions(state), ["😂"]);
    assert.equal(state.status, "pending");
    assert.equal(state.confirmed, null);

    state = applyStoryReactionSuccess(state, second.requestId, "😂");
    assert.deepEqual(selectedStoryReactions(state), ["😂"]);
    assert.equal(state.confirmed, "😂");
    assert.equal(state.status, "sent");
  });

  it("ignores a stale failure and keeps the latest pending highlight", () => {
    let state = createStoryReactionSelection("❤️");
    const first = applyStoryReactionTap(state, "🔥");
    state = first.state;
    const second = applyStoryReactionTap(state, "👀");
    state = second.state;

    state = applyStoryReactionFailure(state, first.requestId);
    assert.deepEqual(selectedStoryReactions(state), ["👀"]);
    assert.equal(state.status, "pending");
    assert.equal(state.error, null);
    assert.equal(state.confirmed, "❤️");
  });

  it("restores the last confirmed reaction when the latest request fails", () => {
    let state = createStoryReactionSelection("❤️");
    const tap = applyStoryReactionTap(state, "🔥");
    state = applyStoryReactionFailure(tap.state, tap.requestId);
    assert.deepEqual(selectedStoryReactions(state), ["❤️"]);
    assert.equal(state.confirmed, "❤️");
    assert.equal(state.status, "error");
    assert.equal(state.error, REACTION_DELIVER_ERROR);
  });

  it("does not let a stale server refresh replace an in-flight selection", () => {
    let state = createStoryReactionSelection("❤️");
    state = applyStoryReactionTap(state, "😂").state;
    state = applyStoryReactionConfirmedFromServer(state, "❤️");
    assert.deepEqual(selectedStoryReactions(state), ["😂"]);
    assert.equal(state.status, "pending");
  });

  it("shows sent only after the latest reaction is confirmed", () => {
    let state = createStoryReactionSelection(null);
    const first = applyStoryReactionTap(state, "🔥");
    state = first.state;
    assert.equal(state.status, "pending");
    state = applyStoryReactionSuccess(state, first.requestId, "🔥");
    assert.equal(state.status, "sent");
    assert.equal(state.selected, "🔥");
  });

  it("keeps a single selection for every displayed emoji", () => {
    const displayed = displayedStoryReactionValues();
    assert.deepEqual(
      displayed,
      STORY_QUICK_REACTIONS.map((reaction) => reaction.emoji)
    );
    assert.deepEqual(displayed, ["💪🏾", "🔥", "👏", "❤️", "👀", "😂", "🤝"]);

    for (const emoji of displayed) {
      let state = createStoryReactionSelection(null);
      const tap = applyStoryReactionTap(state, emoji);
      state = tap.state;
      assert.deepEqual(selectedStoryReactions(state), [emoji]);
      state = applyStoryReactionSuccess(state, tap.requestId, emoji);
      assert.deepEqual(selectedStoryReactions(state), [emoji]);
      assert.equal(state.confirmed, emoji);
      assert.equal(state.status, "sent");
    }
  });

  it("normalizes arm skin-tone aliases to the same displayed value", () => {
    let state = createStoryReactionSelection(null);
    const tap = applyStoryReactionTap(state, "💪");
    state = applyStoryReactionSuccess(tap.state, tap.requestId, "💪");
    assert.equal(state.selected, "💪🏾");
    assert.equal(state.confirmed, "💪🏾");
    state = applyStoryReactionConfirmedFromServer(state, "strong");
    assert.equal(state.selected, "💪🏾");
  });

  it("treats a repeat tap of the selected emoji as one selection, not a second highlight", () => {
    let state = createStoryReactionSelection("❤️");
    const tap = applyStoryReactionTap(state, "❤️");
    state = tap.state;
    assert.deepEqual(selectedStoryReactions(state), ["❤️"]);
    assert.equal(tap.shouldSend, true);
    state = applyStoryReactionSuccess(state, tap.requestId, "❤️");
    assert.deepEqual(selectedStoryReactions(state), ["❤️"]);
    assert.equal(state.confirmed, "❤️");
  });

  it("never highlights more than one emoji across out-of-order responses", () => {
    let state = createStoryReactionSelection("❤️");
    const first = applyStoryReactionTap(state, "🔥");
    state = first.state;
    const second = applyStoryReactionTap(state, "👏");
    state = second.state;
    const third = applyStoryReactionTap(state, "🤝");
    state = third.state;

    state = applyStoryReactionSuccess(state, second.requestId, "👏");
    assert.equal(selectedStoryReactions(state).length, 1);
    assert.deepEqual(selectedStoryReactions(state), ["🤝"]);

    state = applyStoryReactionFailure(state, first.requestId);
    assert.equal(selectedStoryReactions(state).length, 1);
    assert.deepEqual(selectedStoryReactions(state), ["🤝"]);

    state = applyStoryReactionSuccess(state, third.requestId, "🤝");
    assert.deepEqual(selectedStoryReactions(state), ["🤝"]);
    assert.equal(state.status, "sent");
  });

  it("keeps Reaction sent after the parent syncs the same confirmed emoji", () => {
    let state = createStoryReactionSelection(null);
    const tap = applyStoryReactionTap(state, "👀");
    state = applyStoryReactionSuccess(tap.state, tap.requestId, "👀");
    assert.equal(state.status, "sent");
    state = applyStoryReactionConfirmedFromServer(state, "👀");
    assert.equal(state.status, "sent");
    assert.deepEqual(selectedStoryReactions(state), ["👀"]);
  });
});
