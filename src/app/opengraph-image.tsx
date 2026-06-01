import { ImageResponse } from "next/og";

import { site } from "@/lib/site-content";

export const runtime = "edge";
export const alt = `${site.domain} quiet interface`;
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
          background: "radial-gradient(circle at 68% 44%, rgba(102,245,197,0.12), transparent 24%), #020302",
          color: "#eef7f1",
          padding: 64,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", color: "#718078", fontSize: 24 }}>
          <span>{site.domain}</span>
          <span>operator input required</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ color: "#eef7f1", fontSize: 60, letterSpacing: 0 }}>SYSTEM INTERFACE</div>
          <div style={{ color: "#76efb6", fontSize: 30 }}>state: dormant</div>
          <div style={{ color: "#8ea095", fontSize: 28 }}>_</div>
        </div>
        <div style={{ color: "#718078", fontSize: 22 }}>&gt; wake</div>
      </div>
    ),
    size
  );
}
