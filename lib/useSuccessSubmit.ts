import { useEffect, useRef, useState } from "react";

export type SubmitPhase = "idle" | "submitting" | "success";

const DEFAULT_DELAY_MS = 2000;

export function useSuccessSubmit(delayMs = DEFAULT_DELAY_MS) {
  const submittingRef = useRef(false);
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<SubmitPhase>("idle");

  const isLocked = phase === "submitting" || phase === "success";
  const isSubmitting = phase === "submitting";
  const isSuccess = phase === "success";

  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) clearTimeout(navigateTimeoutRef.current);
    };
  }, []);

  function canSubmit() {
    return !submittingRef.current && !navigateTimeoutRef.current && phase === "idle";
  }

  async function submitWithSuccess<T>(
    action: () => Promise<T>,
    onNavigate: (result: T) => void
  ): Promise<void> {
    if (!canSubmit()) return;

    submittingRef.current = true;
    setPhase("submitting");

    try {
      const result = await action();
      setPhase("success");
      navigateTimeoutRef.current = setTimeout(() => {
        try {
          onNavigate(result);
        } finally {
          setPhase("idle");
          submittingRef.current = false;
          navigateTimeoutRef.current = null;
        }
      }, delayMs);
    } catch (error) {
      setPhase("idle");
      submittingRef.current = false;
      throw error;
    }
  }

  return { phase, isLocked, isSubmitting, isSuccess, canSubmit, submitWithSuccess };
}
