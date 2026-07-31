import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./ornate-icon.module.css";

export type OrnateIconTone = "pink" | "lavender" | "mint" | "amber" | "cream";
export type OrnateIconSize = "sm" | "md" | "lg" | "xl";
export type OrnateIconSurface = "dark" | "light";

export interface OrnateIconProps extends HTMLAttributes<HTMLSpanElement> {
  icon: LucideIcon;
  tone?: OrnateIconTone;
  size?: OrnateIconSize;
  surface?: OrnateIconSurface;
  label?: string;
}

/**
 * Enamel-like icon badge used by the admin shell and action cards.
 * The inner Lucide icon stays semantic; the surrounding treatment carries
 * the scrapbook material language from the visual references.
 */
export function OrnateIcon({
  icon: Icon,
  tone = "pink",
  size = "md",
  surface = "dark",
  label,
  className,
  ...props
}: OrnateIconProps) {
  return (
    <span
      {...props}
      className={cn(styles.root, className)}
      data-ornate-icon=""
      data-size={size}
      data-tone={tone}
      data-surface={surface}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <span className={styles.spark} aria-hidden="true" />
      <span className={styles.inner} aria-hidden="true">
        <Icon strokeWidth={2.15} />
      </span>
    </span>
  );
}
