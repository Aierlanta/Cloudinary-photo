/**
 * Sidebar "subject cast" crop helpers.
 *
 * IMPORTANT — this is NOT a true ML / anime-face detector.
 * The repo has no vision model dependency. Strategies below are the best
 * low-dependency options that reuse existing delivery paths:
 *
 * 1) Cloudinary delivery URL → `c_fill,g_auto`
 *    Uses Cloudinary's content-aware gravity (proprietary heuristic).
 *    Good for many portraits; not guaranteed for multi-character / busy CGs.
 *
 * 2) Browser canvas heuristic (alpha bbox → upper-weighted edge energy)
 *    Biases toward head / upper torso for typical portrait illustrations.
 *    Fails on opaque busy backgrounds, groups, or edge-heavy scenery.
 *
 * 3) Last resort: uncropped source URL (caller should CSS object-fit cover
 *    with an upper bias). Never present this as subject detection.
 */

export const SIDEBAR_CAST_DISPLAY_WIDTH = 156;
export const SIDEBAR_CAST_DISPLAY_HEIGHT = 234;

export type SubjectCropStrategy =
  | "cloudinary-g_auto"
  | "canvas-alpha-bbox"
  | "canvas-upper-energy"
  | "direct-uncropped";

export type SubjectCastResolveResult = {
  url: string;
  strategy: SubjectCropStrategy;
  cleanup?: () => void;
};

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export function isCloudinaryDeliveryUrl(url: string): boolean {
  try {
    const host = new URL(url, "https://local.invalid").hostname.toLowerCase();
    return host === "res.cloudinary.com" || /^res-[1-5]\.cloudinary\.com$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Insert / replace a fill+g_auto crop transform on a Cloudinary delivery URL.
 * Returns null when the URL is not a Cloudinary delivery link.
 */
export function buildCloudinarySubjectCropUrl(
  originalUrl: string,
  width: number,
  height: number,
): string | null {
  if (!isCloudinaryDeliveryUrl(originalUrl)) return null;

  try {
    const url = new URL(originalUrl);
    const pathParts = url.pathname.split("/");
    const uploadIndex = pathParts.indexOf("upload");
    if (uploadIndex === -1) return null;

    // g_auto = Cloudinary content-aware gravity (not a local detector).
    const transformations = `w_${Math.round(width)},h_${Math.round(height)},c_fill,g_auto,q_auto,f_auto`;
    const nextParts = pathParts.slice(uploadIndex + 1);

    // Drop a leading transform segment (v123 / w_ / c_ / g_ / …) so we don't
    // stack contradictory crops; version folders (v123456) are kept.
    if (nextParts[0] && /^(?!v\d+$).*(?:_|:)/.test(nextParts[0])) {
      nextParts.shift();
    }

    url.pathname = [...pathParts.slice(0, uploadIndex + 1), transformations, ...nextParts].join("/");
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
}

function loadHtmlImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    assertNotAborted(signal);
    const img = new Image();
    const onAbort = () => {
      img.onload = null;
      img.onerror = null;
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    img.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      resolve(img);
    };
    img.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Failed to decode image for subject crop"));
    };

    // Blob / same-origin: no CORS flag. Cross-origin: anonymous for canvas read.
    if (!src.startsWith("blob:") && !src.startsWith("data:")) {
      try {
        const parsed = new URL(src, window.location.href);
        if (parsed.origin !== window.location.origin) {
          img.crossOrigin = "anonymous";
        }
      } catch {
        img.crossOrigin = "anonymous";
      }
    }

    img.src = src;
  });
}

type CropRect = { sx: number; sy: number; sw: number; sh: number };

function fitAspectAround(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  imgW: number,
  imgH: number,
  aspect: number,
): CropRect {
  let bw = Math.max(1, x1 - x0);
  let bh = Math.max(1, y1 - y0);
  let cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;

  if (bw / bh > aspect) {
    bh = bw / aspect;
  } else {
    bw = bh * aspect;
  }

  // Prefer keeping the top of the subject (heads) when we expand.
  cy = Math.min(cy, y0 + bh * 0.42);

  let sx = cx - bw / 2;
  let sy = cy - bh / 2;
  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + bw > imgW) sx = Math.max(0, imgW - bw);
  if (sy + bh > imgH) sy = Math.max(0, imgH - bh);

  return {
    sx,
    sy,
    sw: Math.min(bw, imgW),
    sh: Math.min(bh, imgH),
  };
}

function findAlphaSubjectRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  aspect: number,
): CropRect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > 24) {
        opaque += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const total = width * height;
  if (opaque < total * 0.04 || maxX < minX || maxY < minY) return null;

  // Expand slightly so hair / outlines are not clipped.
  const padX = Math.max(2, Math.round((maxX - minX) * 0.08));
  const padY = Math.max(2, Math.round((maxY - minY) * 0.1));
  return fitAspectAround(
    Math.max(0, minX - padX),
    Math.max(0, minY - padY),
    Math.min(width, maxX + padX + 1),
    Math.min(height, maxY + padY + 1),
    width,
    height,
    aspect,
  );
}

function findUpperEnergyRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  aspect: number,
): CropRect {
  const targetW = Math.min(width, Math.max(8, Math.round(height * aspect)));
  const targetH = Math.min(height, Math.max(8, Math.round(targetW / aspect)));
  const maxX = Math.max(0, width - targetW);
  const maxY = Math.max(0, height - targetH);

  const luminance = new Float32Array(width * height);
  for (let i = 0, p = 0; i < luminance.length; i += 1, p += 4) {
    luminance[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
  }

  let bestScore = -1;
  let bestX = Math.round(maxX / 2);
  // Bias initial guess toward upper third (typical character head placement).
  let bestY = Math.round(maxY * 0.18);

  const stepX = Math.max(1, Math.floor(targetW / 8));
  const stepY = Math.max(1, Math.floor(targetH / 8));

  for (let y = 0; y <= maxY; y += stepY) {
    const verticalBias = 1.35 - (y / Math.max(1, maxY)) * 0.7;
    for (let x = 0; x <= maxX; x += stepX) {
      let score = 0;
      for (let yy = y + 1; yy < y + targetH - 1; yy += 2) {
        for (let xx = x + 1; xx < x + targetW - 1; xx += 2) {
          const i = yy * width + xx;
          const gx = luminance[i + 1] - luminance[i - 1];
          const gy = luminance[i + width] - luminance[i - width];
          score += Math.abs(gx) + Math.abs(gy);
        }
      }
      score *= verticalBias;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  return { sx: bestX, sy: bestY, sw: targetW, sh: targetH };
}

function analyzeSubjectCrop(
  img: HTMLImageElement,
  aspect: number,
): { rect: CropRect; strategy: Exclude<SubjectCropStrategy, "cloudinary-g_auto" | "direct-uncropped"> } {
  const maxProbe = 96;
  const scale = Math.min(1, maxProbe / Math.max(img.naturalWidth, img.naturalHeight));
  const probeW = Math.max(8, Math.round(img.naturalWidth * scale));
  const probeH = Math.max(8, Math.round(img.naturalHeight * scale));

  const probe = document.createElement("canvas");
  probe.width = probeW;
  probe.height = probeH;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      strategy: "canvas-upper-energy",
      rect: fitAspectAround(0, 0, img.naturalWidth, img.naturalHeight * 0.7, img.naturalWidth, img.naturalHeight, aspect),
    };
  }

  ctx.drawImage(img, 0, 0, probeW, probeH);
  const { data } = ctx.getImageData(0, 0, probeW, probeH);
  const alphaRect = findAlphaSubjectRect(data, probeW, probeH, aspect);
  if (alphaRect) {
    const inv = 1 / scale;
    return {
      strategy: "canvas-alpha-bbox",
      rect: {
        sx: alphaRect.sx * inv,
        sy: alphaRect.sy * inv,
        sw: alphaRect.sw * inv,
        sh: alphaRect.sh * inv,
      },
    };
  }

  const energy = findUpperEnergyRect(data, probeW, probeH, aspect);
  const inv = 1 / scale;
  return {
    strategy: "canvas-upper-energy",
    rect: {
      sx: energy.sx * inv,
      sy: energy.sy * inv,
      sw: energy.sw * inv,
      sh: energy.sh * inv,
    },
  };
}

async function canvasCropToObjectUrl(
  sourceUrl: string,
  width: number,
  height: number,
  signal?: AbortSignal,
): Promise<{ url: string; strategy: SubjectCropStrategy; cleanup: () => void }> {
  const img = await loadHtmlImage(sourceUrl, signal);
  assertNotAborted(signal);

  const aspect = width / height;
  const { rect, strategy } = analyzeSubjectCrop(img, aspect);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("canvas.toBlob failed"))),
      "image/webp",
      0.86,
    );
  });
  assertNotAborted(signal);

  const url = URL.createObjectURL(blob);
  return {
    url,
    strategy,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

/**
 * Resolve a displayable subject-cropped URL from a gallery / random image URL.
 */
export async function resolveSubjectCastFromImageUrl(
  imageUrl: string,
  width: number = SIDEBAR_CAST_DISPLAY_WIDTH,
  height: number = SIDEBAR_CAST_DISPLAY_HEIGHT,
  signal?: AbortSignal,
): Promise<SubjectCastResolveResult> {
  assertNotAborted(signal);

  const cloudinary = buildCloudinarySubjectCropUrl(imageUrl, width, height);
  if (cloudinary) {
    return { url: cloudinary, strategy: "cloudinary-g_auto" };
  }

  try {
    return await canvasCropToObjectUrl(imageUrl, width, height, signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // CORS / decode failure — show source with CSS upper bias (not subject detection).
    return { url: imageUrl, strategy: "direct-uncropped" };
  }
}

/**
 * Pull one random gallery image via the public `/api/random` endpoint, then crop.
 * Same-origin redirects expose their Location so Cloudinary can take the g_auto
 * path. Browsers hide cross-origin Location as an opaque redirect, so those
 * responses are retried with normal redirect following and cropped from bytes.
 */
export async function fetchRandomSubjectCast(
  options: {
    width?: number;
    height?: number;
    signal?: AbortSignal;
    /** Absolute or relative random endpoint (default: same-origin /api/random). */
    endpoint?: string;
  } = {},
): Promise<SubjectCastResolveResult> {
  const width = options.width ?? SIDEBAR_CAST_DISPLAY_WIDTH;
  const height = options.height ?? SIDEBAR_CAST_DISPLAY_HEIGHT;
  const signal = options.signal;
  const base = options.endpoint ?? "/api/random";
  const url = new URL(base, typeof window !== "undefined" ? window.location.origin : "http://local.invalid");
  // Do not force orientation — production libraries are mostly landscape, and
  // the sidebar crop path already fits any aspect into the tall cast frame.
  url.searchParams.delete("orientation");
  // Force the same-origin buffered response path. Plain /api/random may 302 to
  // tgState/Cloudinary; browsers hide that cross-origin Location and CORS often
  // blocks reading the final bytes, so every page would collapse to the one
  // provider that already streams same-origin (Telegram).
  url.searchParams.set("response", "true");
  url.searchParams.set("t", Date.now().toString());

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    signal,
  });

  assertNotAborted(signal);

  if (!response.ok) {
    throw new Error(`Random API failed (${response.status})`);
  }

  const blob = await response.blob();
  assertNotAborted(signal);
  if (!blob.size || !(blob.type || "").startsWith("image/")) {
    throw new Error(`Random API returned non-image payload (${blob.type || "unknown"})`);
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await canvasCropToObjectUrl(objectUrl, width, height, signal);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
