"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./login-home-sprites.module.css";

type SpriteProps<K extends string> = HTMLAttributes<HTMLSpanElement> & {
  kind: K;
};

function createLoginHomeSprite<const K extends readonly string[]>(
  set: "login" | "home",
  basePath: string,
  kinds: K,
) {
  type Kind = K[number];
  const SRC = Object.fromEntries(
    kinds.map((kind) => [kind, `${basePath}/${kind}.svg`]),
  ) as Record<Kind, string>;

  function LoginHomeSprite({ kind, className, ...props }: SpriteProps<Kind>) {
    return (
      <span
        {...props}
        className={cn(styles.root, className)}
        data-login-home-sprite={`${set}:${kind}`}
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

  LoginHomeSprite.displayName = `${set}Sprite`;
  return LoginHomeSprite;
}

/** Login crest — former `public/admin/ui/login-crest.png`. */
export const LoginSprite = createLoginHomeSprite("login", "/admin/ui/login-svg", [
  "crest",
] as const);
export type LoginSpriteKind = Parameters<typeof LoginSprite>[0]["kind"];

/**
 * Home page medallions — former sheets under `public/home/ui/`:
 * nav / admin / stat / footer. Preview-controls bow+heart stay on PNG.
 */
export const HomeSprite = createLoginHomeSprite("home", "/home/ui/home-svg", [
  "nav-docs",
  "nav-github",
  "admin",
  "stat-picture",
  "stat-album",
  "stat-shield",
  "footer-language",
  "footer-sun",
  "footer-moon",
  "footer-github",
] as const);
export type HomeSpriteKind = Parameters<typeof HomeSprite>[0]["kind"];
