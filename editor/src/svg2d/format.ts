import { DEFAULT_GLOBAL_CONFIG } from "./config";

// Port of svg_2d.py::format_dimension. Byte-identical output for the
// feet-inches path used by the current house config (unit_display='feet',
// use_feet_inches=true, unit_conversion=10.0). The decimal-format path
// mirrors the Python `f"{v:.{precision}f}"` format.
export function formatDimension(length: number): string {
  const dim = DEFAULT_GLOBAL_CONFIG.dimensions;
  const converted = length / dim.unit_conversion;
  const precision = dim.precision;
  const unit = dim.unit_display;
  const useFeetInches = dim.use_feet_inches;

  if (unit === "feet" && useFeetInches) {
    let feet = Math.trunc(converted);
    const inches = (converted - feet) * 12;
    let inchesRounded = Math.round(inches);
    if (inchesRounded >= 12) {
      feet += Math.floor(inchesRounded / 12);
      inchesRounded = inchesRounded % 12;
    }
    if (feet > 0 && inchesRounded > 0) return `${feet}' ${inchesRounded}"`;
    if (feet > 0) return `${feet}'`;
    return `${inchesRounded}"`;
  }

  const formatted = converted.toFixed(precision);
  return `${formatted}'${unit === "feet" ? "" : " " + unit}`;
}

// Python's default `f"{v}"` for floats emits `.0` for whole values
// (110.0), while ints render bare (110). JavaScript has one number type,
// so we recreate the Python behavior with a per-value check: values that
// were integers in the source JSON stay bare; anything with fractional
// part uses the default JS float formatting. We rely on the fact that
// JSON numbers with no decimal point become integer-valued JS numbers,
// while decimal ones become non-integer JS numbers. In the SVG output,
// e.g. Python's `f'{x}'` where x=110.0 emits `110.0`; where x=110 emits
// `110`. We reproduce this by tracking whether values arrived as ints.
//
// In practice the flat schema stores integers where the source used
// integers, and floats where it used floats. So JS's default number →
// string coercion won't add `.0`. We only need to *add* `.0` for
// derived-float values (e.g. `wall_thickness/2 = 4.0` in Python but 4
// in JS since 8/2 === 4 exactly). The `f()` helper below applies this
// where needed.
export function f(n: number): string {
  // If the number is integer-valued but was produced by float arithmetic
  // where Python would have kept it as a float (e.g. `0.5 + 0.5 = 1.0`
  // in Python renders as "1.0"), the caller must invoke `fFloat(n)`
  // instead. Default is Python's `int` rendering (no trailing .0).
  return String(n);
}

// Force Python float formatting: whole numbers render with a trailing
// `.0`. Use for values that were derived from float arithmetic on the
// Python side (e.g. `y + offset` where either operand was a float).
export function fFloat(n: number): string {
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
}
