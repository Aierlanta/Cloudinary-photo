'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mount overlays at the admin shell root so they escape the content panel's
 * stacking context while still inheriting the active dark/light theme tokens.
 * Portaling straight to document.body would drop the --admin-* variables
 * declared on the shell and make modal surfaces transparent.
 */
export default function AdminPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  const target = document.querySelector<HTMLElement>('[data-admin-shell]') ?? document.body;
  return createPortal(children, target);
}
