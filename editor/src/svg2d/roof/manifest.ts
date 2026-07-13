// Per-panel SVG split + JSON manifest emission.
// Mirrors svg_2d.py lines 8522-8562.

import type { PanelMeta } from "./compose";

const DEFS = `<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#0066cc"/>
  </marker>
  <style>text { font-family: -apple-system, Arial, sans-serif; }</style>
</defs>
<rect x="0" y="0" width="100%" height="100%" fill="#fafafa"/>
`;

// Python's `json.dump` default: ASCII-escapes non-ASCII characters as \uXXXX,
// and numeric values that are whole-integer-valued Python floats are emitted
// as `N.0`. To reproduce byte-identically we must:
//   1. Escape every non-ASCII code point in strings as \uXXXX
//   2. Emit floats that Python would keep as float (e.g. 298.0, 1218.98…)
//      as `N.0` when integer-valued.
// We track "isFloat" via a wrapper.
export interface PanelManifestEntry {
  id: string;
  title: string;
  file: string;
  width: number;
  height: number;
  _widthIsFloat: boolean;
  _heightIsFloat: boolean;
}

function svgHeader(w: number, h: number, x0: number, y0: number, title: string, wIsFloat: boolean, hIsFloat: boolean, x0IsFloat: boolean, y0IsFloat: boolean): string {
  const wStr = wIsFloat ? pyFloat(w) : pyInt(w);
  const hStr = hIsFloat ? pyFloat(h) : pyInt(h);
  const x0Str = x0IsFloat ? pyFloat(x0) : pyInt(x0);
  const y0Str = y0IsFloat ? pyFloat(y0) : pyInt(y0);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wStr}" height="${hStr}" viewBox="${x0Str} ${y0Str} ${wStr} ${hStr}">\n` +
    `<title>${title}</title>\n` +
    DEFS
  );
}

function pyInt(n: number): string {
  return String(n);
}
function pyFloat(n: number): string {
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}

export interface PanelSplitOutput {
  files: Array<{ filename: string; content: string }>;
  manifestJson: string;
}

export function splitPanels(panels: PanelMeta[]): PanelSplitOutput {
  const files: Array<{ filename: string; content: string }> = [];
  const manifest: PanelManifestEntry[] = [];
  for (const p of panels) {
    const wIsFloat = p.widthIsFloat ?? !Number.isInteger(p.width);
    const hIsFloat = p.heightIsFloat ?? !Number.isInteger(p.height);
    const x0IsFloat = p.x0IsFloat ?? !Number.isInteger(p.x0);
    const y0IsFloat = p.y0IsFloat ?? !Number.isInteger(p.y0);
    const panelSvg =
      svgHeader(p.width, p.height, p.x0, p.y0, p.title, wIsFloat, hIsFloat, x0IsFloat, y0IsFloat) +
      p.svg +
      `</svg>\n`;
    files.push({ filename: `roof_${p.id}.svg`, content: panelSvg });
    manifest.push({
      id: p.id,
      title: p.title,
      file: `roof_${p.id}.svg`,
      width: p.width,
      height: p.height,
      _widthIsFloat: wIsFloat,
      _heightIsFloat: hIsFloat,
    });
  }
  return { files, manifestJson: renderManifestJson(manifest) };
}

// Python's json.dump(indent=2) output. We need ASCII-only strings with
// \uXXXX escapes for non-ASCII, and float values emit trailing .0.
function renderManifestJson(entries: PanelManifestEntry[]): string {
  const parts: string[] = [];
  parts.push("[");
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    parts.push("  {");
    parts.push(`    "id": ${jsonStr(e.id)},`);
    parts.push(`    "title": ${jsonStr(e.title)},`);
    parts.push(`    "file": ${jsonStr(e.file)},`);
    parts.push(`    "width": ${e._widthIsFloat ? pyFloat(e.width) : pyInt(e.width)},`);
    parts.push(`    "height": ${e._heightIsFloat ? pyFloat(e.height) : pyInt(e.height)}`);
    parts.push(i === entries.length - 1 ? "  }" : "  },");
  }
  parts.push("]");
  return parts.join("\n");
}

// Python json.dumps default: ensure_ascii=True, non-ASCII → \uXXXX
function jsonStr(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === 0x22) out += '\\"';
    else if (code === 0x5c) out += "\\\\";
    else if (code === 0x08) out += "\\b";
    else if (code === 0x09) out += "\\t";
    else if (code === 0x0a) out += "\\n";
    else if (code === 0x0c) out += "\\f";
    else if (code === 0x0d) out += "\\r";
    else if (code < 0x20 || code > 0x7e) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += s[i];
    }
  }
  out += '"';
  return out;
}
