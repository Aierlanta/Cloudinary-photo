export type UploadConvertFormat = "original" | "jpeg" | "png" | "webp";

export class UploadConvertError extends Error {
  readonly code: "decode" | "canvas" | "export";
  readonly format?: Exclude<UploadConvertFormat, "original">;

  constructor(
    code: "decode" | "canvas" | "export",
    format?: Exclude<UploadConvertFormat, "original">
  ) {
    super(code);
    this.name = "UploadConvertError";
    this.code = code;
    this.format = format;
  }
}

const MIME_MAP: Record<Exclude<UploadConvertFormat, "original">, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXT_MAP: Record<Exclude<UploadConvertFormat, "original">, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

const QUALITY_MAP: Record<"jpeg" | "webp", number> = {
  jpeg: 0.9,
  webp: 0.85,
};

function replaceImageExtension(filename: string, ext: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return `${base}.${ext}`;
}

export function getUploadImageFormat(
  file: File
): Exclude<UploadConvertFormat, "original"> | undefined {
  const mime = file.type.replace(/^image\//, "").toLowerCase();
  if (mime === "jpg" || mime === "jpeg") return "jpeg";
  if (mime === "png" || mime === "webp") return mime;

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png" || ext === "webp") return ext;
  return undefined;
}

/**
 * 在浏览器里转格式。目标格式和原图一样就原样返回；转失败直接抛错，不回退原图。
 */
export async function convertUploadImage(
  file: File,
  format: UploadConvertFormat
): Promise<File> {
  if (format === "original") {
    return file;
  }

  if (getUploadImageFormat(file) === format) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // Canvas 导出后没有 EXIF，解码时就要按方向转正，不然手机竖拍会横过来
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
  } catch {
    throw new UploadConvertError("decode", format);
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new UploadConvertError("canvas", format);
    }

    if (format === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(bitmap, 0, 0);

    const mimeType = MIME_MAP[format];
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new UploadConvertError("export", format));
            return;
          }
          resolve(result);
        },
        mimeType,
        format === "png" ? undefined : QUALITY_MAP[format]
      );
    });

    return new File([blob], replaceImageExtension(file.name, EXT_MAP[format]), {
      type: mimeType,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}
