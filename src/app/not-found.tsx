import Link from "next/link";

import { QuietSystemMessage } from "@/components/QuietSystemMessage";

export default function NotFound() {
  return (
    <QuietSystemMessage
      label="unmapped"
      title="route not mapped"
      detail="this path is not part of the current surface"
      action={
        <Link
          href="/"
          className="quiet-terminal-link"
        >
          return home
        </Link>
      }
    />
  );
}
