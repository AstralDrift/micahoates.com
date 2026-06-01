"use client";

import { useEffect } from "react";

import { QuietSystemMessage } from "@/components/QuietSystemMessage";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <QuietSystemMessage
      label="fault"
      title="render boundary reached"
      detail="the route hit a recoverable surface error"
      action={
        <button
          type="button"
          onClick={reset}
          className="quiet-terminal-link"
        >
          retry
        </button>
      }
    />
  );
}
