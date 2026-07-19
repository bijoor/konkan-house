// Lighting sliders for the viewer's 3D tab. Reads/writes the shared
// useLightingStore; ViewerScene subscribes to the same store, so dragging
// a slider re-lights the scene live. Rendered into #viewer-lighting-list
// by mount3D.tsx; the surrounding .settings-panel div + CSS live in the
// viewer's HTML shell.

import { LIGHTING_CONTROLS, useLightingStore } from "../three/lighting";

export function ViewerLightingPanel() {
  const state = useLightingStore();

  return (
    <>
      {LIGHTING_CONTROLS.map((c) => {
        const value = state[c.key];
        return (
          <div className="setting-item" key={c.key}>
            <label>
              {c.label}
              <span className="value">{value.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={value}
              onChange={(e) => state.set(c.key, Number(e.target.value))}
            />
          </div>
        );
      })}

      <div className="setting-item">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={state.background}
            onChange={(e) => state.setBackground(e.target.checked)}
          />
          Show sky background
        </label>
      </div>

      <button
        type="button"
        onClick={() => state.reset()}
        style={{
          marginTop: "0.25rem",
          padding: "0.35rem 0.75rem",
          fontSize: "0.8rem",
          border: "1px solid rgba(0,0,0,0.15)",
          borderRadius: "6px",
          background: "#f1f5f9",
          color: "#333",
          cursor: "pointer",
        }}
      >
        Reset lighting
      </button>
    </>
  );
}
