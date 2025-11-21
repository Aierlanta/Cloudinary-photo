import 'sharp';

declare module 'sharp' {
  interface GifOptions {
    /**
     * Enable GIF frame re-optimisation to reduce output size.
     * See https://sharp.pixelplumbing.com/api-output#gif for details.
     */
    reoptimise?: boolean;
  }
}

