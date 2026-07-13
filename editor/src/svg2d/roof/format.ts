// Roof-specific numeric formatters. The Python side uses several
// different format specifiers across the roof panels:
//   - `f'{v}'`               → Python default repr (`f`/`fFloat`)
//   - `f'{v:.1f}'`           → fixed 1-decimal
//   - `f'{v:.2f}'`           → fixed 2-decimal
//   - `f'{v:.0f}'`           → fixed 0-decimal (rounded, no trailing .)
// JavaScript's `Number.toFixed` matches Python's `:.Nf` behaviour for
// finite non-negative-zero values, and negative zero for the display
// path only occurs when small floats round to zero — same as Python.

import { f as _f, fFloat as _fFloat } from "../format";

export const f = _f;
export const fFloat = _fFloat;

// Python's default float formatting uses banker's rounding (round-half-
// to-even), while JS's `toFixed` rounds half away from zero.  For values
// that land exactly on a `.5` boundary at the chosen precision, this
// causes off-by-one drift (e.g. Python `f'{1592.25:.1f}' → "1592.2"` vs
// JS `(1592.25).toFixed(1) → "1592.3"`).  These helpers reproduce
// Python's banker's rounding at N decimal places.
function pyRoundHalfEven(x: number, digits: number): number {
  const m = 10 ** digits;
  const shifted = x * m;
  const floor = Math.floor(shifted);
  const diff = shifted - floor;
  let rounded: number;
  if (Math.abs(diff - 0.5) < 1e-9) {
    // Exactly .5 — round to even
    rounded = floor % 2 === 0 ? floor : floor + 1;
  } else if (diff < 0.5) {
    rounded = floor;
  } else {
    rounded = floor + 1;
  }
  return rounded / m;
}

export function f1(n: number): string {
  return pyRoundHalfEven(n, 1).toFixed(1);
}

export function f2(n: number): string {
  return pyRoundHalfEven(n, 2).toFixed(2);
}

export function f0(n: number): string {
  return pyRoundHalfEven(n, 0).toFixed(0);
}
