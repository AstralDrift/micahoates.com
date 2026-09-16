export const PUZZLE_SPEC = {
  token: "lumen",
  slots: ["N", "M", "L", "E", "U"],
  traceOrder: [3, 5, 2, 4, 1],
  image: {
    path: "/surface/boundary.img",
    manifestPath: "/surface/boundary.img.sha256",
    boundaryLinkPath: "/surface/boundary",
    mountPoint: "/mnt/boundary",
    insidePath: "/mnt/boundary/inside",
    releasePath: "/mnt/boundary/inside/release",
    payload: "quiet-interface boundary image v1\nsignal=lumen\ntrace=3,5,2,4,1\nmode=ro\n",
    checksum: "4744576e715495b3e147065029de1eb1eb06dde97ed4fcf728d31ced59ba2c37",
    manifest: "4744576e715495b3e147065029de1eb1eb06dde97ed4fcf728d31ced59ba2c37  boundary.img\n"
  },
  epilogue: {
    path: "/outside/.afterimage",
    hex: "7468616e6b20796f7520666f72206c6f6f6b696e6720636c6f73656c792e",
    text: "thank you for looking closely."
  }
} as const;

export type PuzzleGate = "signal" | "verification" | "mount";
