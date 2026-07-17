export type WorkEntry = {
  id: string;
  name: string;
  blurb: string;
  href?: string;
  status?: "public" | "private";
  featured?: boolean;
};

export const site = {
  name: "Micah Oates",
  domain: "micahoates.com",
  url: "https://micahoates.com",
  lastModified: "2026-07-17",
  title: "Micah Oates",
  headline: "Systems that survive contact with production.",
  support:
    "Agent tooling, platform engineering, and the trust boundaries that keep ambitious automation from becoming an incident.",
  description:
    "Micah Oates — production systems, agent tooling, and platform engineering. Brand surface with a deeper keyboard interface.",
  githubUrl: "https://github.com/AstralDrift",
  keywords: [
    "Micah Oates",
    "AI systems",
    "agent tooling",
    "platform engineering",
    "DevOps",
    "SRE",
    "automation",
    "developer experience",
    "software engineering",
    "interactive personal website",
    "trust boundaries"
  ],
  work: [
    {
      id: "codex-action-guard",
      name: "codex-action-guard",
      blurb: "Generate and audit safe-by-default OpenAI Codex GitHub Action workflows.",
      href: "https://github.com/AstralDrift/codex-action-guard",
      status: "public",
      featured: true
    },
    {
      id: "tradeplane",
      name: "TradePlane",
      blurb: "Field ops product — auth, QR/mobile flows, reports, uploads, Railway deploy.",
      status: "private",
      featured: true
    },
    {
      id: "micahoates-com",
      name: "micahoates.com",
      blurb: "This site — brand surface with a deeper keyboard interface.",
      href: "https://github.com/AstralDrift/micahoates.com",
      status: "public",
      featured: true
    }
  ] as const satisfies readonly WorkEntry[],
  also: [
    {
      id: "draw-party-game",
      name: "draw-party-game",
      blurb: "Multiplayer draw-and-guess party game.",
      href: "https://github.com/AstralDrift/draw-party-game",
      status: "public"
    }
  ] as const satisfies readonly WorkEntry[]
} as const;
