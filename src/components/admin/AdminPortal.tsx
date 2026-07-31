'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Mount overlays onto document.body so they escape the admin content panel
 * stacking context (panel z-index 10 vs sidebar z-index 30) and overflow clipping.
 */
export default function AdminPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
