import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./ornate-status.module.css";

export type OrnateStatusTone = "healthy" | "warning" | "danger" | "neutral";

export interface OrnateStatusProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  tone?: OrnateStatusTone;
  icon?: LucideIcon;
}

export function OrnateStatus({
  label,
  tone = "healthy",
  icon: Icon,
  className,
  ...props
}: OrnateStatusProps) {
  return (
    <span {...props} className={cn(styles.root, className)} data-tone={tone}>
      {Icon ? <Icon className={styles.icon} aria-hidden /> : <span className={styles.dot} aria-hidden />}
      <span>{label}</span>
    </span>
  );
}

