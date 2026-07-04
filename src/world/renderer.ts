/**
 * Returns the integer pixel ratio for HiDPI rendering, capped at 3.
 * Falls back to 1 in non-browser environments (e.g. Vitest/Node).
 */
export function pixelScale(): number {
  const ratio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  return Math.min(3, Math.max(1, Math.round(ratio)));
}

/**
 * Sizes a canvas for pixel-perfect HiDPI rendering and returns its 2D context.
 * Call once when the canvas is created; the context scale is set permanently.
 * All subsequent drawing should use logical (CSS) pixel coordinates.
 */
export function setupHiDpi(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number
): CanvasRenderingContext2D {
  const r = pixelScale();
  canvas.width  = logicalW * r;
  canvas.height = logicalH * r;
  canvas.style.width  = logicalW + 'px';
  canvas.style.height = logicalH + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return ctx;
}
