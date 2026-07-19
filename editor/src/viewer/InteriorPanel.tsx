// Room picker for the interior walk-through. Pick a room → the 3D camera
// drops to eye level inside it (drag to look, WASD/arrows to walk, Shift to
// go faster). "Overview" returns to the orbit camera. Rendered into
// #viewer-interior-panel by mount3D.tsx; shares useInteriorStore with the
// scene's first-person rig.

import { useMemo } from "react";
import { useConfigStore } from "../state/configStore";
import { listRooms, useInteriorStore } from "../three/interiorView";

export function ViewerInteriorPanel() {
  const config = useConfigStore((s) => s.config);
  const target = useInteriorStore((s) => s.target);
  const enter = useInteriorStore((s) => s.enter);
  const exit = useInteriorStore((s) => s.exit);
  const rooms = useMemo(() => listRooms(config), [config]);

  if (rooms.length === 0) return null;

  const select: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.95)",
    color: "#333",
    fontSize: "0.85rem",
    padding: "0.35rem 0.5rem",
    cursor: "pointer",
    boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", pointerEvents: "auto" }}>
      <span title="Walk inside a room" style={{ fontSize: "1.1rem" }}>🚶</span>
      <select
        value={target?.key ?? ""}
        title="Stand inside a room and look around"
        style={select}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            exit();
            return;
          }
          const r = rooms.find((x) => x.key === v);
          if (r) enter({ key: r.key, label: `${r.floorName}: ${r.name}`, eye: r.eye });
        }}
      >
        <option value="">Overview (orbit)</option>
        {rooms.map((r) => (
          <option key={r.key} value={r.key}>
            {r.floorName}: {r.name}
          </option>
        ))}
      </select>
      {target && (
        <span
          style={{
            fontSize: "0.72rem",
            color: "#475569",
            background: "rgba(255,255,255,0.9)",
            borderRadius: "6px",
            padding: "0.25rem 0.5rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          drag to look · WASD to walk
        </span>
      )}
    </div>
  );
}
