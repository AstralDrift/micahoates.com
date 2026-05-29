import { ImageResponse } from "next/og";

import { site } from "@/lib/site-content";

export const runtime = "edge";
export const alt = `${site.name} personal website`;
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at 18% 80%, rgba(73,221,255,0.32), transparent 32%), radial-gradient(circle at 84% 22%, rgba(113,243,177,0.2), transparent 28%), #03070c",
          color: "white",
          padding: 64,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, color: "#71f3b1" }}>{site.domain}</div>
          <div style={{ fontSize: 24, color: "#a8b4c8" }}>systems / automation / reliability</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>{site.name}</div>
          <div style={{ marginTop: 24, fontSize: 34, lineHeight: 1.35, color: "#c6f6df", maxWidth: 890 }}>
            {site.heroTagline}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, color: "#a8b4c8", fontSize: 24 }}>
          <span>&gt; help</span>
          <span>&gt; about</span>
          <span>&gt; stack</span>
          <span>&gt; systems</span>
          <span>&gt; ai</span>
        </div>
      </div>
    ),
    size
  );
}
