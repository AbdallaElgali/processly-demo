import type { BoundingBox } from '@/types';

/** A highlight rectangle as fractions (0-1) of the displayed page. */
export interface PageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts a backend PDF bounding box into a rectangle on the page as pdf.js
 * displays it.
 *
 * The backend's boxes come from OpenDataLoader (`BDA/src/preprocessor/
 * analyzer/analyzer.py`): `[x0, y0, x1, y1]` in PDF points with a
 * **bottom-left origin**, which the adapter turns into `{x: x0, y: y0, width,
 * height}`. The backend's own debug drawer flips them with
 * `page_height - y1`, and so does this.
 *
 * Two things the old viewer ignored are handled here (plan-A §8, R5):
 * - `view` is the page's box in user space (`page.view`). Its origin is not
 *   always (0, 0); a cropped or offset MediaBox moves every box by that much.
 * - `rotation` is the page's /Rotate (clockwise). pdf.js renders the rotated
 *   page, so the rectangle has to be rotated with it.
 *
 * The old guess that values `<= 1` are normalised is gone: the backend always
 * sends points. Returns null when the box is unusable or lies entirely off the
 * page, so the viewer falls back to the labelled page-level highlight instead
 * of drawing a misleading box.
 */
export function bboxToPageRect(
  bbox: BoundingBox | null | undefined,
  view: readonly [number, number, number, number],
  rotation = 0,
): PageRect | null {
  if (!bbox) return null;
  const nums = [bbox.x, bbox.y, bbox.width, bbox.height];
  if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null;

  const [vx0, vy0, vx1, vy1] = view;
  const W = vx1 - vx0;
  const H = vy1 - vy0;
  if (W <= 0 || H <= 0) return null;

  const bx0 = Math.min(bbox.x, bbox.x + bbox.width);
  const bx1 = Math.max(bbox.x, bbox.x + bbox.width);
  const by0 = Math.min(bbox.y, bbox.y + bbox.height);
  const by1 = Math.max(bbox.y, bbox.y + bbox.height);

  // Unrotated, top-left origin, in points.
  let left = bx0 - vx0;
  let top = vy1 - by1;
  let w = bx1 - bx0;
  let h = by1 - by0;
  let dispW = W;
  let dispH = H;

  const rot = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (rot === 90) {
    [left, top, w, h] = [H - (top + h), left, h, w];
    [dispW, dispH] = [H, W];
  } else if (rot === 180) {
    [left, top] = [W - (left + w), H - (top + h)];
  } else if (rot === 270) {
    [left, top, w, h] = [top, W - (left + w), h, w];
    [dispW, dispH] = [H, W];
  }

  // Clip to the page; drop a box with nothing left on it.
  const l = Math.max(0, left);
  const t = Math.max(0, top);
  const r = Math.min(dispW, left + w);
  const b = Math.min(dispH, top + h);
  if (r <= l || b <= t) return null;

  return { left: l / dispW, top: t / dispH, width: (r - l) / dispW, height: (b - t) / dispH };
}
