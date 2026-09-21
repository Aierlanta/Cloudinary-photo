"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { DashboardSpriteKind } from "./tokens";
import styles from "./dashboard-sprites.module.css";

const SRC: Record<DashboardSpriteKind, string> = {
  "stat-photo": "/admin/ui/dashboard-svg/stat-photo.svg",
  "stat-folder": "/admin/ui/dashboard-svg/stat-folder.svg",
  "stat-clock": "/admin/ui/dashboard-svg/stat-clock.svg",
  "stat-shield": "/admin/ui/dashboard-svg/stat-shield.svg",
  "action-upload": "/admin/ui/dashboard-svg/action-upload.svg",
  "action-folder": "/admin/ui/dashboard-svg/action-folder.svg",
  "action-api": "/admin/ui/dashboard-svg/action-api.svg",
  "action-crest": "/admin/ui/dashboard-svg/action-crest.svg",
  "arrow-pink": "/admin/ui/dashboard-svg/arrow-pink.svg",
  "arrow-lavender": "/admin/ui/dashboard-svg/arrow-lavender.svg",
  "arrow-mint": "/admin/ui/dashboard-svg/arrow-mint.svg",
};

export interface DashboardSpriteProps extends HTMLAttributes<HTMLSpanElement> {
  kind: DashboardSpriteKind;
}

/**
 * Ornate Dashboard UI artwork — SVG recreations of
 * `public/admin/ui/dashboard-*.webp` tiles (leather / stitch / flower).
 * Layout chrome stays in admin-pages.module.css; this only draws the art.
 */
export function DashboardSprite({ kind, className, ...props }: DashboardSpriteProps) {
  return (
    <span
      {...props}
      className={cn(styles.root, className)}
      data-dashboard-sprite={kind}
      aria-hidden={props["aria-hidden"] ?? true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static ornate SVG sprite recreation */}
      <img className={styles.art} src={SRC[kind]} alt="" draggable={false} decoding="async" />
    </span>
  );
}

export { dashboardSpriteTokens } from "./tokens";
export type { DashboardSpriteKind } from "./tokens";
