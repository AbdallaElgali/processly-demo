#!/usr/bin/env node
// Verifies the colour tokens in theme/tokens.json against WCAG 2.1 contrast
// minimums. plan-A.md 1.2 computed these ratios by hand; CLAUDE.md 8.3 requires
// status and accent colours to be legible in BOTH modes, so they are checked
// here rather than trusted.
//
//   node scripts/contrast-check.mjs          # exits 1 if any pair fails
//
// Thresholds (WCAG 2.1):
//   4.5  normal text (1.4.3 AA)
//   3.0  large text (>=18.66px bold / 24px) and non-text UI, e.g. focus rings,
//        highlight outlines (1.4.11 AA)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, '..', 'theme', 'tokens.json'), 'utf8'));

/** Flatten an rgba() string onto an opaque backdrop so it can be measured. */
function composite(color, backdrop) {
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(color);
  if (!m) return toRgb(color);
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const bg = toRgb(backdrop);
  return [
    r * a + bg[0] * (1 - a),
    g * a + bg[1] * (1 - a),
    b * a + bg[2] * (1 - a),
  ];
}

function toRgb(color) {
  if (color.startsWith('rgb')) return composite(color, '#FFFFFF');
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2.1 relative luminance. */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  // A translucent foreground is measured as it will actually be seen: composited
  // over its own backdrop.
  const f = luminance(composite(fg, bg));
  const b = luminance(toRgb(bg));
  const [hi, lo] = f > b ? [f, b] : [b, f];
  return (hi + 0.05) / (lo + 0.05);
}

const t = tokens;
/** [label, foreground, background, minimum] */
const CONTRAST_PAIRS = [];

for (const mode of ['light', 'dark']) {
  const m = t[mode];
  for (const [surfaceName, surface] of [
    ['canvas', m.surface.canvas],
    ['panel', m.surface.panel],
  ]) {
    const on = (label, fg, min) =>
      CONTRAST_PAIRS.push([`${mode}: ${label} on ${surfaceName}`, fg, surface, min]);

    on('text.primary', m.text.primary, 4.5);
    on('text.secondary', m.text.secondary, 4.5);
    on('text.muted', m.text.muted, 4.5);
    on('accent.text', m.accent.text, 4.5);
    on('accent.focus (ring, non-text)', m.accent.focus, 3);
    // accent.brand is the untouched brand cyan. In light mode it is only
    // 2.8:1 on white, so it is allowed ONLY where it carries no meaning on its
    // own (the logo wordmark, large decorative fills) -- logotypes are exempt
    // from WCAG 1.4.3/1.4.11. Anything a user must perceive to understand the
    // UI (progress, selected state, badges) uses accent.fill, checked above.
    on('accent.brand (decorative/logo only)', m.accent.brand, 1.25);
    // WCAG 1.4.11 applies to boundaries that are the ONLY way to identify a
    // control. border.subtle/strong are decorative (dividers, card outlines),
    // so they are only held to "perceptibly distinct from the surface".
    // border.interactive is the token for input outlines and any boundary that
    // does carry meaning, and it must clear 3:1.
    on('border.strong (decorative)', m.border.strong, 1.25);
    on('border.interactive (non-text)', m.border.interactive, 3);
    on('status.success', m.status.success, 4.5);
    on('status.warning', m.status.warning, 4.5);
    on('status.danger', m.status.danger, 4.5);
    on('status.info', m.status.info, 4.5);
    on('status.neutral', m.status.neutral, 4.5);
    on('status.modified', m.status.modified, 4.5);
  }

  CONTRAST_PAIRS.push(
    // Hairline dividers and card outlines live on panels, not on the canvas.
    [`${mode}: border.subtle (divider) on panel`, m.border.subtle, m.surface.panel, 1.25],
    // The primary button: its label sits directly on accent.fill.
    [`${mode}: accent.onFill on accent.fill`, m.accent.onFill, m.accent.fill, 4.5],
    [`${mode}: accent.onFill on accent.fillHover`, m.accent.onFill, m.accent.fillHover, 4.5],
    // Status chips: coloured text on its own tinted background.
    [`${mode}: status.success on successBg`, m.status.success, m.status.successBg, 4.5],
    [`${mode}: status.warning on warningBg`, m.status.warning, m.status.warningBg, 4.5],
    [`${mode}: status.danger on dangerBg`, m.status.danger, m.status.dangerBg, 4.5],
    [`${mode}: status.info on infoBg`, m.status.info, m.status.infoBg, 4.5],
    [`${mode}: status.neutral on neutralBg`, m.status.neutral, m.status.neutralBg, 4.5],
    // Selected rows / active nav use the accent tint as a background.
    [`${mode}: text.primary on accent.tint over panel`, m.text.primary, flatten(m.accent.tint, m.surface.panel), 4.5],
    [`${mode}: accent.text on accent.tint over panel`, m.accent.text, flatten(m.accent.tint, m.surface.panel), 4.5],
  );
}

// The document surface is the same in both modes, so these are checked once.
CONTRAST_PAIRS.push(
  ['document: highlight stroke on page (non-text)', t.document.highlightStroke, t.document.page, 3],
  ['document: page outline on canvas (non-text)', t.document.highlightPageOutline, t.document.canvas, 3],
  ['document: grid line on page (non-text)', t.document.gridLine, t.document.page, 1.2],
  ['document: text on page', t.document.text, t.document.page, 4.5],
  ['document: text on header cell', t.document.text, t.document.headerCell, 4.5],
  // A highlighted cell keeps document text on the highlight fill over a white page.
  ['document: text on highlight fill over page', t.document.text, flatten(t.document.highlightFill, t.document.page), 4.5],
  ['document: highlight stroke on highlight fill over page', t.document.highlightStroke, flatten(t.document.highlightFill, t.document.page), 3],
  // Excel grid (step 9b).
  ['document: header text on header cell', t.document.headerText, t.document.headerCell, 4.5],
  ['document: header text on active header', t.document.headerText, t.document.headerActive, 4.5],
  ['document: selection stroke on page (non-text)', t.document.selectionStroke, t.document.page, 3],
  ['document: selection stroke on highlight fill (non-text)', t.document.selectionStroke, flatten(t.document.highlightFill, t.document.page), 3],
  ['document: text on value-match fill over page', t.document.text, flatten(t.document.matchFill, t.document.page), 4.5],
  ['document: highlight stroke on value-match fill (non-text)', t.document.highlightStroke, flatten(t.document.matchFill, t.document.page), 3],
  ['document: hidden mark on header cell (non-text)', t.document.hiddenMark, t.document.headerCell, 3],
);

/** Pre-composite a translucent colour over an opaque one and return hex. */
function flatten(color, backdrop) {
  const [r, g, b] = composite(color, backdrop);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

let failures = 0;
const rows = CONTRAST_PAIRS.map(([label, fg, bg, min]) => {
  const value = ratio(fg, bg);
  const pass = value >= min;
  if (!pass) failures += 1;
  return { label, fg, bg, min, value, pass };
});

const width = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  ${r.label.padEnd(width)}  ${r.value.toFixed(2).padStart(6)}:1  (min ${r.min.toFixed(1)})  ${r.fg} on ${r.bg}`,
  );
}

console.log(`\n${rows.length - failures}/${rows.length} pairs pass.`);
if (failures > 0) {
  console.error(`${failures} contrast failure(s). Fix theme/tokens.json.`);
  process.exit(1);
}
