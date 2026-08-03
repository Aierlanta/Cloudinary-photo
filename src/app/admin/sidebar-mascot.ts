/**
 * Stable admin sidebar mascot mapping.
 *
 * Preferred assets: /admin/mascots/mascot-01.png … mascot-10.png
 * Graceful fallbacks (when asset agent is mid-flight or uses route names):
 *   1) /admin/mascots/{routeKey}.png
 *   2) /admin/sidebar-mascot.png
 *
 * Mapping strategy:
 * - Exactly 10 nav routes → 1:1 with mascot-01…10 in nav order
 * - Fewer routes → unused slots stay unused; every page still has a mascot
 * - Extra / unknown routes → stable hash into slots 0–9 (never blank)
 */

/** Quick Settings toggle — mirrors admin-panel-opacity localStorage pattern. */
export const SIDEBAR_SUBJECT_CAST_STORAGE_KEY = "admin-sidebar-subject-cast";

export const ADMIN_SIDEBAR_ROUTES = [
  "dashboard",
  "images",
  "gallery",
  "groups",
  "swarm",
  "config",
  "status",
  "logs",
  "backup",
  "security",
] as const;

export type AdminSidebarRoute = (typeof ADMIN_SIDEBAR_ROUTES)[number];

export const SIDEBAR_MASCOT_FALLBACK = "/admin/sidebar-mascot.png";

function stableSlot(routeKey: string): number {
  const known = ADMIN_SIDEBAR_ROUTES.indexOf(routeKey as AdminSidebarRoute);
  if (known >= 0) return known;

  let hash = 0;
  for (let i = 0; i < routeKey.length; i += 1) {
    hash = (hash * 31 + routeKey.charCodeAt(i)) >>> 0;
  }
  return hash % ADMIN_SIDEBAR_ROUTES.length;
}

/** 1-based slot index for display / debugging (01…10). */
export function getSidebarMascotIndex(routeKey: string): number {
  return stableSlot(routeKey) + 1;
}

/**
 * Ordered src candidates for a route. First existing image wins via onError chain.
 */
export function getSidebarMascotSources(routeKey: string): string[] {
  const slot = stableSlot(routeKey);
  const nn = String(slot + 1).padStart(2, "0");
  const preferred = `/admin/mascots/mascot-${nn}.png`;
  const byRoute = `/admin/mascots/${routeKey}.png`;
  const bySlotRoute = `/admin/mascots/${ADMIN_SIDEBAR_ROUTES[slot]}.png`;

  const sources = [preferred, byRoute];
  if (bySlotRoute !== byRoute) sources.push(bySlotRoute);
  sources.push(SIDEBAR_MASCOT_FALLBACK);
  return sources;
}
