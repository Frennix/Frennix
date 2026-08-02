import { useEffect, useRef } from "react";
import { useModeration } from "@/lib/useModeration";

type TrainingPartnerDeckSafetyProps = {
  userId: string;
  partnerId: string;
  onPartnerRemoved: () => void;
};

/** Moderation sheets + block handling for the training partner deck. */
export function useTrainingPartnerDeckSafety({
  userId,
  partnerId,
  onPartnerRemoved,
}: TrainingPartnerDeckSafetyProps) {
  const { openUserModeration, moderationSheets, blockMutation } = useModeration(userId);
  const handledBlock = useRef(false);

  useEffect(() => {
    if (blockMutation.isSuccess && !handledBlock.current) {
      handledBlock.current = true;
      onPartnerRemoved();
      blockMutation.reset();
    }
    if (!blockMutation.isSuccess) {
      handledBlock.current = false;
    }
  }, [blockMutation, blockMutation.isSuccess, onPartnerRemoved]);

  return {
    openUserModeration: () => openUserModeration(partnerId),
    moderationSheets,
  };
}
