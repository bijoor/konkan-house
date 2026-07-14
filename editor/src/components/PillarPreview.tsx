// Pillar preview panel — renders the 4 outer pillar elevations plus
// each internal-row/column section using the TypeScript port
// (editor/src/svg2d/pillar/). Same generator the parity harness
// diffs byte-identically against Python.

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useConfigStore } from "../state/configStore";
import { generateAllPillarSvgs } from "../svg2d/pillar/index";
import type { HouseConfig as ExpandHouseConfig } from "../svg2d/expand";

export function PillarPreview() {
  const config = useConfigStore((s) => s.config)!;
  const [selected, setSelected] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);

  const items = useMemo(
    () => generateAllPillarSvgs(config as ExpandHouseConfig),
    [config],
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
        <p>No ground-floor pillars in the current configuration.</p>
        <p className="mt-2 text-xs text-slate-500">
          Add {" "}<code className="rounded bg-slate-800 px-1">pillar</code>
          {" "}objects to floor 0 to see the elevations here.
        </p>
      </div>
    );
  }

  const current = items.find((i) => i.filename === selected) ?? items[0];

  const download = () => {
    const blob = new Blob([current.content], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {items.map((it) => (
          <button
            key={it.filename}
            type="button"
            onClick={() => setSelected(it.filename)}
            className={clsx(
              "rounded px-3 py-1 text-xs",
              current.filename === it.filename
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            )}
            title={it.filename}
          >
            {it.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setShowRaw((s) => !s)}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600"
          >
            {showRaw ? "Preview" : "View raw"}
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded bg-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-600"
          >
            Download {current.filename}
          </button>
        </div>
      </div>

      {showRaw ? (
        <pre className="flex-1 overflow-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
          {current.content}
        </pre>
      ) : (
        <div
          className="flex-1 overflow-auto rounded border border-slate-800 bg-white p-2"
          // Safe: SVG from our own generator, not user input.
          dangerouslySetInnerHTML={{ __html: current.content }}
        />
      )}
    </div>
  );
}
