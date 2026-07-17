// Floating panel that renders the v2 top-view SVG for the currently
// selected roof source (house config or a demo). Shows the same
// RoofSpec that the 3D preview is rendering, but as a 2D top-down
// SVG — mirrors what the future "Roof detail" tab will show.

import { useMemo } from "react";
import type { HouseConfig } from "../svg2d/expand";
import { derivePitchedRoof } from "../svg2d/roof/v2/derivePitched";
import { deriveShedRoof } from "../svg2d/roof/v2/deriveShed";
import { resolveJoints, ridgeZFromConfig } from "../svg2d/roof/v2/resolveJoints";
import type { RoofSpec } from "../svg2d/roof/v2/model";
import { renderTopViewPanel } from "../svg2d/roof/v2/topViewPanel";
import { computeAllBom } from "../svg2d/roof/v2/bom";
import { findDemo, type V2DemoId } from "./v2Demos";
import { computeMergedV2Spec } from "./v2RoofFromHouse";

export function V2TopViewPanel({
  config,
  demoId,
}: {
  config: HouseConfig;
  demoId: V2DemoId;
}) {
  const { svg, sourceLabel, bom } = useMemo(() => {
    try {
      const demo = findDemo(demoId);
      let spec: RoofSpec;
      let label: string;
      if (demo) {
        const wallTopZ = 100;
        if (demo.config.roof_type === "shed") {
          spec = deriveShedRoof(demo.config, { wallTopZ });
          if (demo.config.segments.length > 1) {
            spec = resolveJoints(demo.config, spec, { wallTopZ, ridgeZ: wallTopZ });
          }
        } else {
          spec = derivePitchedRoof(demo.config, { wallTopZ });
          if (demo.config.segments.length > 1) {
            const ridgeZ = ridgeZFromConfig(demo.config, wallTopZ);
            spec = resolveJoints(demo.config, spec, { wallTopZ, ridgeZ });
          }
        }
        label = demo.label;
      } else {
        spec = computeMergedV2Spec(config);
        label = "House roofs (v2)";
      }
      return {
        svg: renderTopViewPanel(spec, { width: 320, height: 260, title: label }),
        sourceLabel: label,
        bom: computeAllBom(spec),
      };
    } catch (e) {
      console.warn("[v2topview] render failed:", e);
      return { svg: null, sourceLabel: "error", bom: null };
    }
  }, [config, demoId]);

  if (!svg) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-2">
      <div className="rounded border border-slate-700 bg-slate-900/85 p-1 backdrop-blur">
        <div
          className="pointer-events-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="mt-1 text-center text-[10px] text-slate-500">
          v2 top view · {sourceLabel}
        </div>
      </div>
      {bom && bom.frame.length > 0 && (
        <div className="pointer-events-auto max-h-[280px] w-[320px] overflow-y-auto rounded border border-slate-700 bg-slate-900/85 p-2 backdrop-blur">
          <div className="mb-1 text-[10px] font-semibold text-fuchsia-400">Frame BOM (v2)</div>
          <table className="w-full text-[9px] text-slate-300">
            <thead className="border-b border-slate-700 text-slate-500">
              <tr>
                <th className="text-left">Item</th>
                <th className="text-right">Count</th>
                <th className="text-right">Max ft</th>
                <th className="text-right">Total ft</th>
              </tr>
            </thead>
            <tbody>
              {bom.frame.map((r, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="pr-1 py-0.5 text-slate-200">{r.item}</td>
                  <td className="text-right tabular-nums">{r.count}</td>
                  <td className="text-right tabular-nums">{r.maxLenFt.toFixed(1)}</td>
                  <td className="text-right tabular-nums">{r.totalLenFt.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bom.metal.length > 0 && (
            <>
              <div className="mb-1 mt-2 text-[10px] font-semibold text-fuchsia-400">Metal BOM (v2)</div>
              <table className="w-full text-[9px] text-slate-300">
                <thead className="border-b border-slate-700 text-slate-500">
                  <tr>
                    <th className="text-left">Spec</th>
                    <th className="text-right">Total ft</th>
                    <th className="text-right">Pieces</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.metal.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="pr-1 py-0.5 font-mono text-slate-200">{r.matSpec}</td>
                      <td className="text-right tabular-nums">{r.totalLenFt.toFixed(1)}</td>
                      <td className="text-right tabular-nums">{r.piecesToOrder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

