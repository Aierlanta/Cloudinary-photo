/**
 * Dashboard UI sprite tokens — sampled from public/admin/ui/dashboard-*.webp
 * for the sample SVG recreation (leather / stitch / flower motif).
 * Scope: Dashboard page only.
 */
export const dashboardSpriteTokens = {
  cream: "#f8e0c8",
  creamDeep: "#f0d8b8",
  creamStitch: "#f4efe8",
  leatherPink: "#e06080",
  leatherPinkDeep: "#c85070",
  leatherPinkSoft: "#f08ba0",
  leatherLavender: "#b088c8",
  leatherLavenderDeep: "#9060a0",
  leatherPurple: "#503050",
  leatherPurpleDeep: "#402840",
  leatherTeal: "#306050",
  leatherTealDeep: "#284848",
  leatherTan: "#e8b878",
  leatherTanDeep: "#c89058",
  leatherBrown: "#885038",
  leatherBrownDeep: "#5c3820",
  gold: "#e8c878",
  goldBright: "#f5d76e",
  goldDeep: "#b87840",
  goldRim: "#c9a080",
  flowerPink: "#ec738d",
  flowerLavender: "#a986d0",
  flowerGold: "#f0d570",
  leafSage: "#9ea175",
  leafOlive: "#8c846c",
  ink: "#3d2516",
  bowPink: "#ec738d",
  mintArrow: "#2d3e41",
  mintMetal: "#3a3a3a",
  heartPink: "#f56bb0",
  heartPinkDeep: "#c84080",
  crestField: "#60486b",
  shadow: "rgba(56, 36, 62, 0.28)",
  radiusShell: "14px",
} as const;

export type DashboardSpriteKind =
  | "stat-photo"
  | "stat-folder"
  | "stat-clock"
  | "stat-shield"
  | "action-upload"
  | "action-folder"
  | "action-api"
  | "action-crest"
  | "arrow-pink"
  | "arrow-lavender"
  | "arrow-mint";
