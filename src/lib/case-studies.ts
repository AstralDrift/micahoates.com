export type CaseStudy = {
  id: string;
  title: string;
  status: "public" | "private";
  href?: string;
  summary: string;
  problem: string;
  boundary: string;
  mechanism: string;
  stillBreaks: string;
};

export const primaryCase: CaseStudy = {
  id: "codex-action-guard",
  title: "codex-action-guard",
  status: "public",
  href: "https://github.com/AstralDrift/codex-action-guard",
  summary:
    "Codex in GitHub Actions is powerful. Unsafe workflow composition puts prompts, secrets, write tokens, and untrusted PR text in the same trust boundary.",
  problem:
    "Maintainers paste agent workflows together until a comment, issue body, or fork PR can influence a privileged Codex run. The failure mode is not “model said something wrong” — it is privilege and provenance collapse.",
  boundary:
    "Treat workflow text, Codex prompts, and repository secrets as separate trust domains. Anything that can write to the repo or exfiltrate tokens must not ingest untrusted natural language in the same step without an explicit, audited profile.",
  mechanism:
    "codex-action-guard generates safe-by-default Codex Action profiles and audits existing workflows. Findings are evidence-bound (Markdown, JSON, SARIF) so humans or agents can remediate without guessing.",
  stillBreaks:
    "Rule packs lag novel workflow shapes. False positives happen. The tool cannot invent organizational policy — it can only make unsafe composition visible and harder to ship by accident."
};

export const secondaryCases: CaseStudy[] = [
  {
    id: "tradeplane",
    title: "TradePlane",
    status: "private",
    summary: "Field ops software where auth, QR/mobile, uploads, reports, and Railway deploys share one promotion path.",
    problem:
      "Field tools fail when web assumptions meet phones, offline-ish networks, and “it worked on staging” deploys that never touched the QR path.",
    boundary:
      "Tenant isolation and deploy gates are product features. Preview → staging → production must prove the workflow that operators actually run.",
    mechanism:
      "Canonical repo, PR previews, local validation gates, and smoke against the deployed head before merge. Constraints over ceremony.",
    stillBreaks:
      "Private product — no public metrics. The hard parts remain: device variance, auth edge cases, and keeping runbooks honest when the system moves."
  }
];
