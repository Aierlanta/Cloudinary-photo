"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./admin-ui-sprites.module.css";

type SpriteProps<K extends string> = HTMLAttributes<HTMLSpanElement> & {
  kind: K;
};

function createAdminUiSprite<const K extends readonly string[]>(
  set: string,
  kinds: K,
) {
  type Kind = K[number];
  const SRC = Object.fromEntries(
    kinds.map((kind) => [kind, `/admin/ui/${set}-svg/${kind}.svg`]),
  ) as Record<Kind, string>;

  function AdminUiSprite({ kind, className, ...props }: SpriteProps<Kind>) {
    return (
      <span
        {...props}
        className={cn(styles.root, className)}
        data-admin-ui-sprite={`${set}:${kind}`}
        aria-hidden={props["aria-hidden"] ?? true}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static ornate SVG sprite recreation */}
        <img
          className={styles.art}
          src={SRC[kind]}
          alt=""
          draggable={false}
          decoding="async"
        />
      </span>
    );
  }

  AdminUiSprite.displayName = `${set}Sprite`;
  return AdminUiSprite;
}

/** Gallery toolbar / selection charms — former `gallery-actions.webp`. */
export const GallerySprite = createAdminUiSprite("gallery", [
  "add",
  "refresh",
  "download",
  "checklist",
  "check",
  "move",
  "trash",
  "close",
] as const);
export type GallerySpriteKind = Parameters<typeof GallerySprite>[0]["kind"];

/** Groups metrics / actions — former `groups-icons.webp` + `groups-actions.webp`. */
export const GroupsSprite = createAdminUiSprite("groups", [
  "icon-tag",
  "icon-album",
  "icon-check",
  "icon-plus",
  "action-refresh",
  "action-create",
  "action-edit",
  "action-trash",
  "action-close",
  "action-save",
  "action-album",
  "action-view",
] as const);
export type GroupsSpriteKind = Parameters<typeof GroupsSprite>[0]["kind"];

/** Logs toolbar + level badges — former `logs-actions.webp` + `logs-levels.webp`. */
export const LogsSprite = createAdminUiSprite("logs", [
  "action-refresh",
  "action-export",
  "action-trash",
  "action-search",
  "action-warning",
  "level-0",
  "level-1",
  "level-2",
  "level-3",
] as const);
export type LogsSpriteKind = Parameters<typeof LogsSprite>[0]["kind"];

/** Config illustrations / actions — former `config-icons.webp` + `config-actions.webp`. */
export const ConfigSprite = createAdminUiSprite("config", [
  "icon-shield",
  "icon-lock",
  "icon-toggle",
  "icon-notebook",
  "action-refresh",
  "action-save",
  "action-add",
  "action-edit",
  "action-trash",
  "action-copy",
  "action-external",
  "action-play",
] as const);
export type ConfigSpriteKind = Parameters<typeof ConfigSprite>[0]["kind"];

/** Status service / metric icons — former `status-icons.webp`. */
export const StatusSprite = createAdminUiSprite("status", [
  "shield",
  "clock",
  "calendar",
  "server",
] as const);
export type StatusSpriteKind = Parameters<typeof StatusSprite>[0]["kind"];

/** Backup icons / actions — former `backup-icons.webp` + `backup-actions.webp`. */
export const BackupSprite = createAdminUiSprite("backup", [
  "icon-tl",
  "icon-tr",
  "icon-bl",
  "icon-br",
  "action-create",
  "action-initialize",
  "action-refresh",
  "action-settings",
  "action-restore",
  "action-warning",
  "action-close",
  "action-health",
] as const);
export type BackupSpriteKind = Parameters<typeof BackupSprite>[0]["kind"];

/** Security icons / actions — former `security-icons.webp` + `security-actions.webp`. */
export const SecuritySprite = createAdminUiSprite("security", [
  "icon-shield",
  "icon-ban",
  "icon-clock",
  "icon-br",
  "action-refresh",
  "action-chart",
  "action-location",
  "action-trash",
  "action-close",
  "action-key",
  "action-alert",
  "action-arrow",
] as const);
export type SecuritySpriteKind = Parameters<typeof SecuritySprite>[0]["kind"];

/** Swarm icons / actions — former `swarm-icons.webp` + `swarm-actions.webp`. */
export const SwarmSprite = createAdminUiSprite("swarm", [
  "icon-tl",
  "icon-tr",
  "icon-bl",
  "icon-br",
  "action-refresh",
  "action-save",
  "action-network",
  "action-warning",
  "action-database",
  "action-settings",
  "action-shield",
  "action-arrow",
] as const);
export type SwarmSpriteKind = Parameters<typeof SwarmSprite>[0]["kind"];

/** Upload hero + action charms — former `upload-hero.webp` + `upload-actions.webp`. */
export const UploadSprite = createAdminUiSprite("upload", [
  "hero",
  "image",
  "cloud",
  "heart",
  "settings",
  "refresh",
  "trash",
  "close",
  "check",
] as const);
export type UploadSpriteKind = Parameters<typeof UploadSprite>[0]["kind"];
