export function BrandSchematic() {
  return (
    <svg
      className="brand-schematic"
      viewBox="0 0 420 480"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="schematic-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
          <stop offset="45%" stopColor="var(--accent-primary)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* frame ticks */}
      <g className="brand-schematic-frame" stroke="currentColor" strokeWidth="1" fill="none">
        <path d="M24 24h36M24 24v36" />
        <path d="M396 24h-36M396 24v36" />
        <path d="M24 456h36M24 456v-36" />
        <path d="M396 456h-36M396 456v-36" />
      </g>

      {/* ordinate */}
      <g className="brand-schematic-grid" stroke="currentColor" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1="56" y1={72 + i * 44} x2="64" y2={72 + i * 44} />
        ))}
        <line x1="60" y1="64" x2="60" y2="400" />
        <line x1="60" y1="400" x2="360" y2="400" />
      </g>

      {/* signal path */}
      <path
        className="brand-schematic-signal"
        d="M72 340 C110 340, 118 210, 156 210 S210 360, 248 300 S300 120, 348 148"
        fill="none"
        stroke="url(#schematic-line)"
        strokeWidth="1.5"
        strokeLinecap="square"
      />

      {/* nodes */}
      <g className="brand-schematic-nodes">
        <circle cx="156" cy="210" r="3.5" />
        <circle cx="248" cy="300" r="3.5" />
        <circle cx="348" cy="148" r="3.5" />
      </g>

      {/* labels */}
      <g className="brand-schematic-labels">
        <text x="168" y="204">
          carrier
        </text>
        <text x="258" y="296">
          signal
        </text>
        <text x="300" y="136">
          boundary
        </text>
        <text x="72" y="428">
          TRACE // local-only
        </text>
      </g>

      {/* scanner */}
      <line className="brand-schematic-scan" x1="80" y1="88" x2="80" y2="392" />
    </svg>
  );
}
