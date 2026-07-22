// Non-blocking channel for parametric-formula problems (cycles, unknown refs,
// bad expressions). Mirrors three/House3D.tsx::reportGeometryWarnings — kept
// OUT of the React render path: we stash on window and fire a CustomEvent that
// a banner can listen for (Phase 2). Headless/tests: no window, so it just
// no-ops (callers read the returned warnings array directly).

export interface FormulaWarning {
  // Human-locating tag, e.g. "variables/colB" or "floor0/obj3/x".
  where: string;
  formula: string;
  message: string;
}

declare global {
  interface Window {
    __formulaWarnings?: FormulaWarning[];
  }
}

export function reportFormulaWarnings(warnings: FormulaWarning[]): void {
  if (typeof window === "undefined") return;
  window.__formulaWarnings = warnings;
  try {
    window.dispatchEvent(
      new CustomEvent("wadi-formula-warnings", { detail: warnings }),
    );
  } catch {
    /* CustomEvent unavailable — ignore */
  }
  if (warnings.length > 0) {
    // Surface during development without a banner yet.
    console.warn(
      `[parametric] ${warnings.length} formula warning(s):`,
      warnings.map((w) => `${w.where}: ${w.message} [${w.formula}]`),
    );
  }
}
