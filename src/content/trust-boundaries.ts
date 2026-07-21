export const trustBoundariesNote = {
  slug: "trust-boundaries",
  title: "Trust boundaries around agents",
  description:
    "A short note on keeping prompts, secrets, and write authority from collapsing into one unsafe surface.",
  published: "2026-07-17",
  body: `Agents are not dangerous because they are clever. They are dangerous because we wire them into systems that already have power.

A model that can only talk is a toy. A model that can open a pull request, read a secret, or run in CI with write credentials is an operator. Operators need boundaries.

The failure mode I care about is not hallucination. It is provenance collapse: untrusted text (a PR comment, an issue body, a pasted log) ends up in the same trust domain as a privileged action. Once that happens, “the model decided” is a story we tell after the incident.

Safe composition looks boring. Separate the channels. Decide what may influence a prompt. Decide what may hold a token. Decide what may mutate the repository. Prefer profiles that are readable by humans and auditable by machines. Prefer evidence over vibes — SARIF, structured findings, diffs you can review.

Platform work is the same shape with different nouns. Field software that ships QR flows and uploads through Railway still needs a promotion path that proves the workflow operators actually run — not the happy path that only exists on a laptop.

I build tooling that makes the unsafe path harder to take by accident: guards around Codex in GitHub Actions, deploy discipline for products that leave the browser, interfaces that reveal contact only after a deliberate path. The aesthetic is quiet because the stakes are not.

If you take one rule from this site: do not let natural language from strangers share a step with write authority. Everything else is commentary.`
} as const;
