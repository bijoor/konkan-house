import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Environment,
  OrbitControls,
  Grid,
  Stats,
} from "@react-three/drei";
import {
  EffectComposer,
  N8AO,
  ToneMapping,
  SMAA,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import clsx from "clsx";
import { House3D } from "./House3D";
import { V2RoofMesh } from "./V2RoofMesh";
import { V2TopViewPanel } from "./V2TopViewPanel";
import { V2_DEMOS, type V2DemoId } from "./v2Demos";
import { effectiveLayers, useLayerStore } from "./layers";
import { readPlotBounds } from "./coords";
import { expandRoomWalls, type HouseConfig } from "../svg2d/expand";

type PresetName = "iso" | "front" | "back" | "left" | "right" | "top";

interface CameraPreset {
  name: PresetName;
  label: string;
  // Position expressed as (radius-multiplier, azimuth-deg, polar-deg)
  // relative to the plot centre. We compute an actual XYZ at render
  // time from the current plot bounds.
  radiusMult: number;
  azimuthDeg: number;
  polarDeg: number;
}

const PRESETS: CameraPreset[] = [
  { name: "iso", label: "Iso", radiusMult: 1.8, azimuthDeg: 135, polarDeg: 55 },
  { name: "front", label: "Front", radiusMult: 1.5, azimuthDeg: 180, polarDeg: 80 },
  { name: "back", label: "Back", radiusMult: 1.5, azimuthDeg: 0, polarDeg: 80 },
  { name: "left", label: "Left", radiusMult: 1.5, azimuthDeg: 90, polarDeg: 80 },
  { name: "right", label: "Right", radiusMult: 1.5, azimuthDeg: 270, polarDeg: 80 },
  { name: "top", label: "Top", radiusMult: 1.5, azimuthDeg: 180, polarDeg: 1 },
];

export function ThreePreview({ config }: { config: HouseConfig }) {
  const plot = readPlotBounds(expandRoomWalls(config));
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  // Radius from plot centre — enough to see the whole thing plus margin.
  const baseRadius = Math.hypot(plot.width, plot.length) * 0.75;

  // Section cutter — a horizontal clipping plane at this world-Z. `null`
  // disables clipping entirely. Range is anchored on the whole-model
  // envelope (plinth height 30 up to typical ridge ~300).
  const [cutZ, setCutZ] = useState<number | null>(null);

  // V2 roof preview toggles. Debug / comparison overlay for the new
  // segment-based roof pipeline (editor/src/svg2d/roof/v2/). When
  // any of these are on, the v2 spec renders ON TOP of the legacy
  // roof meshes so you can compare.
  const [v2Enabled, setV2Enabled] = useState(false);
  const [v2ShowPlanes, setV2ShowPlanes] = useState(true);
  const [v2ShowMembers, setV2ShowMembers] = useState(true);
  const [v2ShowTrusses, setV2ShowTrusses] = useState(false);
  const [v2JointsOnly, setV2JointsOnly] = useState(false);
  const [v2Demo, setV2Demo] = useState<V2DemoId>("house");
  const clippingPlanes = useMemo(() => {
    if (cutZ === null) return [];
    // Plane with normal (0, 1, 0) at height cutZ, oriented so points
    // ABOVE the plane get clipped (constant = cutZ, normal = -Y).
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), cutZ)];
  }, [cutZ]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">Camera:</span>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(controlsRef.current, p, baseRadius)}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            {p.label}
          </button>
        ))}
        <SectionCutter cutZ={cutZ} setCutZ={setCutZ} />
        <V2Toggle
          enabled={v2Enabled}
          setEnabled={setV2Enabled}
          showPlanes={v2ShowPlanes}
          setShowPlanes={setV2ShowPlanes}
          showMembers={v2ShowMembers}
          setShowMembers={setV2ShowMembers}
          showTrusses={v2ShowTrusses}
          setShowTrusses={setV2ShowTrusses}
          jointsOnly={v2JointsOnly}
          setJointsOnly={setV2JointsOnly}
          demo={v2Demo}
          setDemo={setV2Demo}
        />
        <div className="ml-auto">
          <LayerPanelToggle config={config} />
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden rounded border border-slate-800">
        <Canvas
          shadows
          camera={{
            position: [baseRadius * 0.7, baseRadius * 0.8, baseRadius * 0.7],
            fov: 45,
            near: 1,
            far: baseRadius * 20,
          }}
          gl={{
            antialias: true,
            localClippingEnabled: true,
          }}
        >
          <ClippingApplier planes={clippingPlanes} />
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[baseRadius * 0.8, baseRadius * 1.2, baseRadius * 0.5]}
            intensity={1.0}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <Suspense fallback={null}>
            <Environment preset="sunset" background={false} />
          </Suspense>
          <Grid
            args={[plot.width * 2, plot.length * 2]}
            cellSize={10}
            cellThickness={0.5}
            cellColor="#334155"
            sectionSize={100}
            sectionThickness={1}
            sectionColor="#475569"
            fadeDistance={baseRadius * 4}
            infiniteGrid={false}
            position={[0, -0.02, 0]}
          />
          <House3D config={config} />
          {v2Enabled && (
            <V2RoofMesh
              config={config}
              showPlanes={v2ShowPlanes}
              showMembers={v2ShowMembers}
              showTrusses={v2ShowTrusses}
              showJointsOnly={v2JointsOnly}
              demoId={v2Demo}
            />
          )}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.1}
          />
          {/* Ambient occlusion + antialiasing + tone mapping. N8AO is
              much faster than the SSAO effect on complex scenes; SMAA
              catches the aliased CSG edges the browser MSAA misses. */}
          <EffectComposer multisampling={0} enableNormalPass>
            <N8AO
              aoRadius={12}
              intensity={2.5}
              distanceFalloff={0.5}
              color="black"
            />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
          {import.meta.env.DEV && <Stats />}
          <CameraLogger />
        </Canvas>
        <LayerPanel config={config} />
        {v2Enabled && <V2TopViewPanel config={config} demoId={v2Demo} />}
      </div>
    </div>
  );
}

// Rotates the OrbitControls camera to a preset position. Uses the
// three.js spherical convention (azimuth around Y-up axis).
function applyPreset(
  controls: OrbitControlsImpl | null,
  p: CameraPreset,
  baseRadius: number,
) {
  if (!controls) return;
  const cam = controls.object;
  const radius = baseRadius * p.radiusMult;
  const az = (p.azimuthDeg * Math.PI) / 180;
  const pol = (p.polarDeg * Math.PI) / 180;
  const x = radius * Math.sin(pol) * Math.sin(az);
  const y = radius * Math.cos(pol);
  const z = radius * Math.sin(pol) * Math.cos(az);
  cam.position.set(x, y, z);
  controls.target.set(0, 0, 0);
  controls.update();
}

// Silent hook that just makes sure the camera state stays coherent
// (placeholder for future camera-state persistence).
function CameraLogger() {
  useThree();
  return null;
}

// Applies clipping planes globally by walking the scene's materials and
// setting `clippingPlanes`. Runs whenever the plane list changes.
function ClippingApplier({ planes }: { planes: THREE.Plane[] }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = true;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      const apply = (m: THREE.Material) => {
        m.clippingPlanes = planes;
        m.clipShadows = true;
      };
      if (Array.isArray(mat)) mat.forEach(apply);
      else if (mat) apply(mat);
    });
  }, [planes, scene, gl]);
  return null;
}

function SectionCutter({
  cutZ,
  setCutZ,
}: {
  cutZ: number | null;
  setCutZ: (z: number | null) => void;
}) {
  // The plinth-plus-two-floors envelope tops out around Z=320 for this
  // house; give a slightly wider range so the slider covers the ridge.
  const MIN = 30;
  const MAX = 350;
  return (
    <div className="flex items-center gap-2 border-l border-slate-800 pl-2">
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={cutZ !== null}
          onChange={(e) => setCutZ(e.target.checked ? 150 : null)}
          className="accent-emerald-500"
        />
        Section
      </label>
      {cutZ !== null && (
        <>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={1}
            value={cutZ}
            onChange={(e) => setCutZ(Number(e.target.value))}
            className="w-40 accent-emerald-500"
          />
          <span className="w-12 text-right font-mono text-[10px] text-slate-500">
            Z={cutZ}
          </span>
        </>
      )}
    </div>
  );
}

function V2Toggle({
  enabled,
  setEnabled,
  showPlanes,
  setShowPlanes,
  showMembers,
  setShowMembers,
  showTrusses,
  setShowTrusses,
  jointsOnly,
  setJointsOnly,
  demo,
  setDemo,
}: {
  enabled: boolean;
  setEnabled: (b: boolean) => void;
  showPlanes: boolean;
  setShowPlanes: (b: boolean) => void;
  showMembers: boolean;
  setShowMembers: (b: boolean) => void;
  showTrusses: boolean;
  setShowTrusses: (b: boolean) => void;
  jointsOnly: boolean;
  setJointsOnly: (b: boolean) => void;
  demo: V2DemoId;
  setDemo: (d: V2DemoId) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-l border-slate-800 pl-2">
      <label className="flex items-center gap-1 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-fuchsia-500"
        />
        <span className="text-fuchsia-400">v2 roof</span>
      </label>
      {enabled && (
        <>
          <select
            value={demo}
            onChange={(e) => setDemo(e.target.value as V2DemoId)}
            className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-200"
            title="Data source for the v2 preview"
          >
            <option value="house">House config</option>
            {V2_DEMOS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={showPlanes}
              onChange={(e) => setShowPlanes(e.target.checked)}
              className="accent-sky-500"
            />
            planes
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={showMembers}
              onChange={(e) => setShowMembers(e.target.checked)}
              className="accent-red-500"
            />
            members
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={showTrusses}
              onChange={(e) => setShowTrusses(e.target.checked)}
              className="accent-purple-500"
            />
            trusses
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-500">
            <input
              type="checkbox"
              checked={jointsOnly}
              onChange={(e) => setJointsOnly(e.target.checked)}
              className="accent-blue-500"
            />
            joints only
          </label>
        </>
      )}
    </div>
  );
}

function LayerPanelToggle({ config }: { config: HouseConfig }) {
  const setAll = useLayerStore((s) => s.setAll);
  const ids = useMemo(() => effectiveLayers(config).map((l) => l.id), [config]);
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setAll(ids, true)}
        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
      >
        Show all
      </button>
      <button
        type="button"
        onClick={() => setAll(ids, false)}
        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
      >
        Hide all
      </button>
    </div>
  );
}

function LayerPanel({ config }: { config: HouseConfig }) {
  const layers = useMemo(() => effectiveLayers(config), [config]);
  const visible = useLayerStore((s) => s.visible);
  const toggle = useLayerStore((s) => s.toggle);
  return (
    <div className="pointer-events-auto absolute right-3 top-3 max-h-[85%] w-52 overflow-y-auto rounded border border-slate-700 bg-slate-900/85 p-2 backdrop-blur">
      <div className="mb-1 text-xs font-semibold text-slate-400">Layers</div>
      {layers.map((l) => {
        const on = visible[l.id] !== false;
        return (
          <label
            key={l.id}
            className={clsx(
              "flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs",
              on ? "text-slate-100" : "text-slate-500",
            )}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => toggle(l.id)}
              className="accent-emerald-500"
            />
            <span
              className="inline-block h-3 w-3 rounded-sm border border-slate-700"
              style={{ background: l.color }}
            />
            <span className="truncate">{l.label}</span>
          </label>
        );
      })}
    </div>
  );
}
