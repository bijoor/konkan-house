import { describe, expect, it } from "vitest";
import { evalFormula, formulaDeps } from "./formula";

describe("evalFormula", () => {
  const v = (src: string, scope = {}) => evalFormula(src, scope).value;

  it("literals and the optional leading '='", () => {
    expect(v("= 3")).toBe(3);
    expect(v("3")).toBe(3);
    expect(v("=1.5")).toBe(1.5);
    expect(v("= .5")).toBe(0.5);
  });

  it("operator precedence and parens", () => {
    expect(v("= 2 + 3 * 4")).toBe(14);
    expect(v("= (2 + 3) * 4")).toBe(20);
    expect(v("= 10 - 2 - 3")).toBe(5); // left-assoc
    expect(v("= 10 / 4")).toBe(2.5);
    expect(v("= 2 * (3 + 4) / 7")).toBe(2);
  });

  it("unary minus and plus", () => {
    expect(v("= -5 + 2")).toBe(-3);
    expect(v("= -(2 + 3)")).toBe(-5);
    expect(v("= +4")).toBe(4);
    expect(v("= 3 * -2")).toBe(-6);
  });

  it("references from scope, including dotted point fields", () => {
    expect(v("= a * 2", { a: 5 })).toBe(10);
    expect(v("= P.x + 5", { "P.x": 10 })).toBe(15);
    expect(v("= colA + bay", { colA: 100, bay: 50 })).toBe(150);
  });

  it("reports unknown references without throwing", () => {
    const r = evalFormula("= b + 1", {});
    expect(r.value).toBeNull();
    expect(r.error).toMatch(/unknown|unresolved/);
  });

  it("reports division by zero", () => {
    const r = evalFormula("= 1 / 0", {});
    expect(r.value).toBeNull();
    expect(r.error).toMatch(/zero/);
  });

  it("reports parse errors without throwing", () => {
    expect(evalFormula("= 1 +", {}).value).toBeNull();
    expect(evalFormula("= (1 + 2", {}).value).toBeNull();
    expect(evalFormula("= 1 2", {}).value).toBeNull();
    expect(evalFormula("= @", {}).value).toBeNull();
  });
});

describe("function calls (min/max/clamp/round/floor/ceil/abs)", () => {
  it("evaluates min/max/clamp", () => {
    expect(evalFormula("= min(3, 5)", {}).value).toBe(3);
    expect(evalFormula("= max(3, 5, 4)", {}).value).toBe(5);
    expect(evalFormula("= clamp(12, 0, 10)", {}).value).toBe(10);
    expect(evalFormula("= clamp(-2, 0, 10)", {}).value).toBe(0);
    expect(evalFormula("= clamp(5, 0, 10)", {}).value).toBe(5);
  });

  it("evaluates round/floor/ceil/abs", () => {
    expect(evalFormula("= round(19.6)", {}).value).toBe(20);
    expect(evalFormula("= floor(19.6)", {}).value).toBe(19);
    expect(evalFormula("= ceil(19.1)", {}).value).toBe(20);
    expect(evalFormula("= abs(0 - 7)", {}).value).toBe(7);
  });

  it("nests calls and mixes with arithmetic + scope", () => {
    // spare-flight pattern: max(0, total - k*perFlight)
    expect(evalFormula("= max(0, total - 2 * per)", { total: 20, per: 7 }).value).toBe(6);
    expect(evalFormula("= max(0, total - 3 * per)", { total: 20, per: 7 }).value).toBe(0);
    expect(evalFormula("= min(max(a, 1), 10)", { a: 5 }).value).toBe(5);
  });

  it("errors on unknown function or bad arity", () => {
    expect(evalFormula("= wat(1)", {}).value).toBeNull();
    expect(evalFormula("= clamp(1, 2)", {}).value).toBeNull();
    expect(evalFormula("= min()", {}).value).toBeNull();
  });
});

describe("formulaDeps", () => {
  it("extracts referenced symbols", () => {
    expect(formulaDeps("= a + P.x * b").sort()).toEqual(["P.x", "a", "b"]);
    expect(formulaDeps("= 1 + 2")).toEqual([]);
    expect(formulaDeps("= colB").sort()).toEqual(["colB"]);
  });

  it("collects deps from call args but not the function name", () => {
    expect(formulaDeps("= max(0, total - k * per)").sort()).toEqual(["k", "per", "total"]);
  });

  it("returns [] on parse error", () => {
    expect(formulaDeps("= 1 +")).toEqual([]);
  });
});
