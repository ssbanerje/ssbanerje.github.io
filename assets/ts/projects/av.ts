/**
 * @fileoverview Interactive figures and colocated statistical, vehicle-kinematics,
 * and Kalman-estimation models for the Autonomous Vehicle Resilience project
 * page (`av`).
 */

import d3Line, { type LineGen } from 'd3-shape/line';
import { monotoneX } from 'd3-shape/monotone';
import { assertNever, clamp, createRng, fmtSigned, h, lerp, linearScale, matchRule, memoBy, mountFigure, patchAttrs, range, setShow, setText, svgEl, type FigureSpec, type LinearScale, type MountHandle, type Rng } from '../lib/engine';
import { addArrowMarker, bindDrag, createChart, mountBadge, renderTopo, type BadgeUpdater, type ChartHandle, type EdgePatch, type NodePatch, type TopoConfig, type TopoEdgeDef, type TopoHeaderDef, type TopoNodeDef, type TopoPatch } from '../lib/layers';

// Abramowitz & Stegun 26.2.17 normal tail P(Z > z) with negative-z symmetry guard.
function normalTail(z: number): number {
  if (z < 0) {
    return 1 - normalTail(-z);
  }
  const t = 1 / (1 + 0.2316419 * z);
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + 1.330274429 * t))));
  return (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
}

// Abramowitz & Stegun 26.2.23 rational inverse normal CDF Phi^{-1}(p).
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) {
    return p <= 0 ? -8 : 8;
  }
  if (p === 0.5) {
    return 0;
  }
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  const z = t - (2.515517 + t * (0.802853 + 0.010328 * t)) / (1 + t * (1.432788 + t * (0.189269 + 0.001308 * t)));
  return p < 0.5 ? -z : z;
}

// Figure 1: Hardware-Layer Fault Injection (BDLFI)
type BdlMode = 'interior' | 'boundary';
type BandPt = readonly [number, number, number];
type PdfPt = readonly [number, number];

interface ProbeCoords { readonly x: number; readonly y: number }
interface BdlFeatureSpace {
  readonly chart: ChartHandle; readonly vulnBands: ReadonlyArray<(data: readonly BandPt[]) => void>;
  readonly probeGroup: SVGGElement; readonly probeTag: SVGGElement;
}
interface BdlPanelsDom {
  readonly bitSpans: readonly HTMLSpanElement[]; readonly expLeg: HTMLSpanElement;
  readonly leftLbl: HTMLSpanElement; readonly rightLbl: HTMLSpanElement;
  readonly benignArea: (data: readonly PdfPt[]) => void; readonly flipArea: (data: readonly PdfPt[]) => void; readonly pdfLine: (data: readonly PdfPt[]) => void;
}

const BDL_CFG = { seed: 0.334455, probeBound: 0.92, marginNear: 0.55, marginMid: 0.95 } as const;
const BDL_PRESETS: Record<BdlMode, ProbeCoords> = { interior: { x: -0.58, y: 0.68 }, boundary: { x: 0.08, y: 0.14 } };

const BDL_SPEC: FigureSpec<BdlMode> = {
  kicker: 'Figure 1 · Hardware-Layer Fault Injection (BDLFI) · Floating-Point Weight Bit-Flips and Decision-Boundary Vulnerability',
  modes: [{ id: 'interior', label: 'Confident Input (Far)' }, { id: 'boundary', label: 'Boundary Input (Near)', active: true }],
  actions: ['play'], stepMs: 650,
  legend: [
    { kind: 'line', tone: 'navy', label: 'Classifier decision boundary' },
    { kind: 'band', tone: 'crimson', label: 'Vulnerable boundary zone' },
    { kind: 'swatch', tone: 'blue', label: 'Correct class confidence' },
    { kind: 'swatch', tone: 'crimson', label: 'Flipped class prediction' },
  ],
  grid: 'is-2col',
  panels: [
    { kind: 'plot', title: 'CLASSIFIER FEATURE SPACE (DRAG TEST INPUT)', svgId: 'svg-av-bdlfi-a' },
    { kind: 'plot', cls: 'is-stack', subpanels: [{ title: '32-BIT IEEE-754 WEIGHT REGISTER UPSETS', mountId: 'bdl-bits-panel' }, { title: 'PERTURBED LOGIT CONFIDENCE & CLASS-FLIP TAIL', svgId: 'svg-av-bdlfi-b', mountId: 'bdl-axis-panel', mountCls: 'viz-row-hd' }] },
  ],
  sliders: [{ key: 'ber', label: 'Hardware bit-error rate', min: -5.0, max: -1.2, step: 0.1, value: -3.2, fmt: (lp) => {
    const pct = 10 ** lp * 100;
    return `${pct.toFixed(pct >= 0.1 ? 2 : 3)}% / bit`;
  } }],
  radios: [{ key: 'ecc', label: 'Exponent-bit ECC protection', value: 'off', options: [{ value: 'off', label: 'OFF' }, { value: 'on', label: 'ON (8 bits)' }] }],
  metrics: [{ key: 'placement', label: 'Input placement' }, { key: 'spread', label: 'Confidence spread' }, { key: 'flipRisk', label: 'Class-flip risk' }],
};

function boundaryCurveY(x: number): number {
  return 0.34 * Math.sin(x * 2.5) + 0.12 * x;
}

function logitAt(x: number, y: number): number {
  return 1.55 * (y - boundaryCurveY(x));
}

const BOUNDARY_PTS: ReadonlyArray<readonly [number, number]> = range(49).map((idx) => {
  const nx = (idx / 48) * 2 - 1;
  return [nx, boundaryCurveY(nx)];
});
const VULN_FACTORS: readonly number[] = [0.04, 0.12, 0.22, 0.34].map((tau) => normalQuantile(1 - tau) / 1.55);
const Z_GRID: readonly number[] = range(91).map((idx) => -2.4 + (idx / 90) * 4.8);

const calcVulnBands = memoBy((sigmaZ: number): ReadonlyArray<readonly BandPt[]> =>
  VULN_FACTORS.map((zFactor) => {
    const dy = sigmaZ * zFactor;
    return BOUNDARY_PTS.map(([bx, by]): BandPt => [bx, by - dy, by + dy]);
  }),
);

const calcBdlPdf = memoBy((zNom: number, sigmaZ: number): { readonly pdfPts: readonly PdfPt[]; readonly benignPts: readonly PdfPt[]; readonly flipPts: readonly PdfPt[] } => {
  const pdfPts = Z_GRID.map((z): PdfPt => [z, Math.exp(-0.5 * ((z - zNom) / sigmaZ) ** 2)]);
  const posSide = pdfPts.filter(([z]) => z >= 0);
  const negSide = pdfPts.filter(([z]) => z <= 0);
  return { pdfPts, benignPts: zNom >= 0 ? posSide : negSide, flipPts: zNom >= 0 ? negSide : posSide };
});

function sampleWeightBits(berLog10: number, eccOn: boolean, rng: Rng): number {
  const pBit = clamp(1 - (1 - 10 ** berLog10) ** 110, 0.004, 0.85);
  return range(32).reduce((mask, bitIdx) => {
    const skip = eccOn && bitIdx >= 1 && bitIdx <= 8;
    return !skip && rng.next() < pBit ? (mask | (1 << bitIdx)) >>> 0 : mask;
  }, 0);
}

function buildBdlFeatureSpace(svgNode: SVGSVGElement, onMoveProbe: (nx: number, ny: number, isDelta: boolean) => void): BdlFeatureSpace {
  const chart = createChart(svgNode, { box: [272, 224], pad: [8, 8, 8, 8], x: [-1, 1], y: [-1, 1] });
  chart.area<readonly [number, number]>((d) => d[0], (d) => d[1], () => 1, 'is-blue-bg')(BOUNDARY_PTS);
  chart.area<readonly [number, number]>((d) => d[0], () => -1, (d) => d[1], 'is-teal-bg')(BOUNDARY_PTS);
  const vulnBands = VULN_FACTORS.map(() => chart.area<BandPt>((d) => d[0], (d) => d[1], (d) => d[2], 'is-vuln'));
  chart.line<readonly [number, number]>((d) => d[0], (d) => d[1], 'is-navy')(BOUNDARY_PTS);
  const probeTag = svgEl('g', null, svgEl('rect', { y: -21, width: 62, height: 15, rx: 3.5, cls: 'bdl-probe-tag' }), svgEl('text', { x: 31, y: -10.5, 'text-anchor': 'middle' }, 'Test Input'));
  const probeGroup = svgEl('g', { cls: 'bdl-probe', style: 'pointer-events:none' }, svgEl('circle', { cls: 'viz-pulse-ring', r: 10.5 }), svgEl('circle', { cls: 'bdl-probe-dot', r: 5.5 }), probeTag);
  chart.overlayEl.append(svgEl('text', { cls: 'viz-rule-lbl is-blue', x: chart.x0 + 7, y: chart.y0 + 14 }, 'Predicted: Vehicle'), svgEl('text', { cls: 'viz-rule-lbl is-teal', x: chart.x0 + 7, y: chart.y1 - 6 }, 'Predicted: Road'), probeGroup);
  bindDrag(chart.svgNode, (px, py) => {
    onMoveProbe(chart.sx.invert(px), chart.sy.invert(py), false);
  });
  patchAttrs(chart.svgNode, { tabindex: 0, role: 'group', 'aria-label': 'Classifier feature space — use arrow keys to move Test Input' });
  chart.svgNode.addEventListener('keydown', (event: KeyboardEvent) => {
    const step = event.shiftKey ? 0.15 : 0.05;
    const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
    const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0;
    if (dx || dy) {
      event.preventDefault();
      onMoveProbe(dx, dy, true);
    }
  });
  return { chart, vulnBands, probeGroup, probeTag };
}

function buildBdlPanelsDom(bitsEl: HTMLElement, pdfSvg: SVGSVGElement, axisEl: HTMLElement): BdlPanelsDom {
  const bitSpans = range(32).map(() => h('span', { cls: 'bit-cell' }));
  const expLeg = h('span', { cls: 'is-amber' });
  bitsEl.replaceChildren(
    h('div', { cls: 'bit-strip' }, ...bitSpans),
    h('div', { cls: 'viz-row-hd viz-mono' }, h('span', { cls: 'is-slate' }, 'Sign (1b)'), expLeg, h('span', { cls: 'is-blue' }, 'Mantissa (23b)')),
  );
  const pdfChart = createChart(pdfSvg, { box: [296, 128], pad: [16, 8, 6, 8], x: [-2.4, 2.4], y: [0, 1.08] });
  const benignArea = pdfChart.area<PdfPt>((d) => d[0], () => 0, (d) => d[1], 'is-blue');
  const flipArea = pdfChart.area<PdfPt>((d) => d[0], () => 0, (d) => d[1], 'is-crimson');
  const pdfLine = pdfChart.line<PdfPt>((d) => d[0], (d) => d[1], 'is-blue');
  pdfChart.vrule('is-crimson is-dashed', 'Class-Flip Threshold')(0);
  const leftLbl = h('span', { cls: 'viz-mono' });
  const rightLbl = h('span', { cls: 'viz-mono' });
  axisEl.replaceChildren(leftLbl, rightLbl);
  return { bitSpans, expLeg, leftLbl, rightLbl, benignArea, flipArea, pdfLine };
}

function updateBdlBitsDom(bits: number, eccOn: boolean, panels: BdlPanelsDom): void {
  for (const [bitIdx, span] of panels.bitSpans.entries()) {
    const hit = ((bits >>> bitIdx) & 1) === 1;
    const isExp = bitIdx >= 1 && bitIdx <= 8;
    const base = bitIdx === 0 ? ' is-sign' : isExp ? (eccOn ? ' is-ecc' : ' is-exp') : '';
    const hitCls = !hit ? '' : bitIdx === 0 || (isExp && !eccOn) ? ' is-hit-exp' : ' is-hit-mant';
    patchAttrs(span, { cls: `bit-cell${base}${hitCls}` });
  }
  patchAttrs(panels.expLeg, { cls: eccOn ? 'is-teal' : 'is-amber' });
  setText(panels.expLeg, eccOn ? 'Exponent (8b · ECC)' : 'Exponent (8b · scale swings)');
}

function renderBdlView(ctx: MountHandle<BdlMode>, state: { readonly probe: ProbeCoords; readonly bits: number }, fs: BdlFeatureSpace, panels: BdlPanelsDom): void {
  const p = 10 ** ctx.num('ber');
  const eccOn = ctx.radio('ecc') === 'on';
  const sigmaZ = clamp(0.055 + 0.35 * Math.sqrt(p * 120) + (eccOn ? 0.03 * Math.sqrt(p * 1000) : 16.5 * p ** 0.88), 0.05, 2.4);
  const zNom = logitAt(state.probe.x, state.probe.y);
  const absZ = Math.abs(zNom);
  const pFlip = normalTail(absZ / sigmaZ);
  ctx.setMetric('spread', matchRule([[sigmaZ < 0.35, 'Narrow (mantissa rounding)'], [sigmaZ < 0.85, eccOn ? 'Moderate (mantissa + sign noise)' : 'Moderate (mantissa noise)']], eccOn ? 'Wide (sign + multi-bit mantissa)' : 'Wide (exponent scale spikes)'));
  ctx.setMetric('placement', absZ < BDL_CFG.marginNear ? 'Near boundary (low margin)' : absZ < BDL_CFG.marginMid ? 'Moderate class margin' : 'Confident interior (high margin)', 'is-blue');
  ctx.setMetric('flipRisk', `${(pFlip * 100).toFixed(1)}%`, pFlip > 0.08 ? 'is-crimson' : 'is-teal');
  for (const [idx, bandData] of calcVulnBands(sigmaZ).entries()) {
    fs.vulnBands[idx](bandData);
  }
  const px = fs.chart.sx(state.probe.x);
  patchAttrs(fs.probeGroup, { transform: `translate(${px},${fs.chart.sy(state.probe.y)})` });
  patchAttrs(fs.probeTag, { transform: `translate(${px < fs.chart.x1 - 78 ? 11 : -73},0)` });
  setText(panels.leftLbl, zNom >= 0 ? '← Flipped (Road)' : '← Correct (Road)');
  setText(panels.rightLbl, zNom >= 0 ? 'Correct (Vehicle) →' : 'Flipped (Vehicle) →');
  const { pdfPts, benignPts, flipPts } = calcBdlPdf(zNom, sigmaZ);
  panels.benignArea(benignPts);
  panels.flipArea(flipPts);
  panels.pdfLine(pdfPts);
  updateBdlBitsDom(state.bits, eccOn, panels);
}

mountFigure('av-bdlfi', BDL_SPEC, (ctx) => {
  const rng = createRng(BDL_CFG.seed);
  let probe = BDL_PRESETS[ctx.mode()];
  let bits = sampleWeightBits(ctx.num('ber'), ctx.radio('ecc') === 'on', rng);
  const panels = buildBdlPanelsDom(ctx.el('bdl-bits-panel'), ctx.svg('svg-av-bdlfi-b'), ctx.el('bdl-axis-panel'));
  const fs = buildBdlFeatureSpace(ctx.svg('svg-av-bdlfi-a'), (valX, valY, isDelta) => {
    probe = { x: clamp(isDelta ? probe.x + valX : valX, -BDL_CFG.probeBound, BDL_CFG.probeBound), y: clamp(isDelta ? probe.y + valY : valY, -BDL_CFG.probeBound, BDL_CFG.probeBound) };
    ctx.setMode(Math.abs(logitAt(probe.x, probe.y)) < BDL_CFG.marginNear ? 'boundary' : 'interior');
    renderBdlView(ctx, { probe, bits }, fs, panels);
  });
  return {
    step: () => {
      bits = sampleWeightBits(ctx.num('ber'), ctx.radio('ecc') === 'on', rng);
    },
    onCtrl: (key) => {
      if (key === 'mode') {
        probe = BDL_PRESETS[ctx.mode()];
        return;
      }
      bits = sampleWeightBits(ctx.num('ber'), ctx.radio('ecc') === 'on', rng);
    },
    render: () => {
      renderBdlView(ctx, { probe, bits }, fs, panels);
    },
  };
});

// Shared Kinematic Bicycle Solver & Roadway Scene (Figures 2 & 3)
interface StopPoint { readonly x: number; readonly y: number }
interface StopTrajectory { readonly pts: readonly StopPoint[]; readonly xStop: number; readonly yStop: number }
interface BicycleStopSpec { readonly v0: number; readonly phi0: number; readonly aMax: number; readonly delaySec: number; readonly accelDelay: number }
interface BicycleState { readonly timeSec: number; readonly x: number; readonly y: number; readonly speed: number; readonly heading: number }

const KINEMATICS_CFG = { wheelbaseM: 2.85, dtSec: 0.04, maxSteps: 400 } as const;

function rk4BicycleStep(st: BicycleState, dt: number, accel: number, tanPhiL: number): Pick<BicycleState, 'x' | 'y' | 'heading'> {
  const u1 = st.speed;
  const k1t = u1 * tanPhiL;
  const u2 = Math.max(0, st.speed + 0.5 * dt * accel);
  const th2 = st.heading + 0.5 * dt * k1t;
  const k2t = u2 * tanPhiL;
  const th3 = st.heading + 0.5 * dt * k2t;
  const k3t = u2 * tanPhiL;
  const u4 = Math.max(0, st.speed + dt * accel);
  const th4 = st.heading + dt * k3t;
  return {
    x: st.x + (dt / 6) * (u1 * Math.cos(st.heading) + 2 * u2 * Math.cos(th2) + 2 * u2 * Math.cos(th3) + u4 * Math.cos(th4)),
    y: st.y + (dt / 6) * (u1 * Math.sin(st.heading) + 2 * u2 * Math.sin(th2) + 2 * u2 * Math.sin(th3) + u4 * Math.sin(th4)),
    heading: st.heading + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + u4 * tanPhiL),
  };
}

function integrateBicycleStop(spec: BicycleStopSpec): StopTrajectory {
  const tanPhiL = Math.tan(spec.phi0) / KINEMATICS_CFG.wheelbaseM;
  const pts: StopPoint[] = [{ x: 0, y: 0 }];
  let st: BicycleState = { timeSec: 0, x: 0, y: 0, speed: spec.v0, heading: 0 };
  for (let stepIdx = 0; st.speed > 1e-6 && stepIdx < KINEMATICS_CFG.maxSteps; stepIdx++) {
    const inDelay = st.timeSec < spec.delaySec - 1e-9;
    const accel = inDelay ? spec.accelDelay : -spec.aMax;
    const dt = inDelay ? Math.min(KINEMATICS_CFG.dtSec, spec.delaySec - st.timeSec) : Math.min(KINEMATICS_CFG.dtSec, st.speed / spec.aMax);
    const nextPos = rk4BicycleStep(st, dt, accel, tanPhiL);
    const speed = inDelay ? Math.max(0, st.speed + dt * accel) : dt + 1e-9 >= st.speed / spec.aMax ? 0 : st.speed - dt * spec.aMax;
    const timeSec = inDelay && dt >= spec.delaySec - st.timeSec - 1e-9 ? spec.delaySec : st.timeSec + dt;
    st = { ...nextPos, speed, timeSec };
    pts.push({ x: st.x, y: st.y });
  }
  return { pts, xStop: st.x, yStop: st.y };
}

function yAtX(pts: readonly StopPoint[], targetX: number): number {
  const hitIdx = pts.findIndex((pt, idx) => idx > 0 && pt.x >= targetX);
  if (hitIdx < 0) {
    return pts[pts.length - 1]?.y ?? 0;
  }
  const p0 = pts[hitIdx - 1];
  const p1 = pts[hitIdx];
  const dx = p1.x - p0.x;
  return dx > 1e-9 ? lerp(p0.y, p1.y, clamp((targetX - p0.x) / dx, 0, 1)) : p1.y;
}

interface RoadwayBase { readonly obsM: number; readonly obsLabel: string; readonly crashed: boolean; readonly badgeText: string; readonly badgeCls?: string }
type TrajectoryRoadwayView = RoadwayBase & { readonly kind: 'trajectory'; readonly safePath: readonly StopPoint[]; readonly atkPath: readonly StopPoint[] };
type EncounterRoadwayView = RoadwayBase & {
  readonly kind: 'encounter'; readonly ghostFrac: number; readonly safeStopM: number;
  readonly egoM?: number; readonly atkStartM?: number; readonly egoTone: 'navy' | 'teal' | 'crimson';
};
type RoadwayView = TrajectoryRoadwayView | EncounterRoadwayView;

interface RoadwayConfig { readonly box: readonly [number, number]; readonly maxM: number; readonly ticksM: readonly number[] }
interface RoadwayGhost { readonly grp: SVGGElement; readonly arr: SVGLineElement; readonly box: SVGRectElement; readonly txt: SVGTextElement; readonly note: SVGTextElement }
interface RoadwayScene {
  readonly boxW: number; readonly padX: number; readonly padY: number; readonly rw: number; readonly rh: number;
  readonly sx: LinearScale; readonly sy: LinearScale; readonly lineGen: LineGen<StopPoint>;
  readonly zones: { readonly safe: SVGRectElement; readonly warn: SVGRectElement; readonly crash: SVGRectElement; readonly hatch: SVGRectElement };
  readonly lane: { readonly line: SVGLineElement; readonly adjLbl: SVGTextElement; readonly egoLbl: SVGTextElement };
  readonly curves: { readonly safe: SVGPathElement; readonly atk: SVGPathElement; readonly impact: SVGCircleElement };
  readonly ghost: RoadwayGhost;
  readonly cars: { readonly obsG: SVGGElement; readonly obsTxt: SVGTextElement; readonly safeTagG: SVGGElement; readonly egoG: SVGGElement };
  readonly setBadge: BadgeUpdater; readonly border: SVGRectElement;
}

let roadSeq = 0;

function makeRoadCar(cls: string, width: number, height: number, label = ''): readonly [SVGGElement, SVGTextElement] {
  const txt = svgEl('text', { y: 3, 'text-anchor': 'middle' }, label);
  return [svgEl('g', { cls }, svgEl('rect', { x: -width / 2, y: -height / 2, width, height, rx: 3.5 }), txt), txt];
}

function buildRoadwayGhost(aid: string): RoadwayGhost {
  const arr = svgEl('line', { cls: 'viz-edge is-blue', 'marker-end': `url(#${aid})` });
  const box = svgEl('rect', { width: 36, height: 18, rx: 4 });
  const txt = svgEl('text', { 'text-anchor': 'middle' }, 'GHOST');
  const note = svgEl('text', { cls: 'road-ghost-note', 'text-anchor': 'end' }, 'Spoofed Track (Adj. Lane)');
  return { grp: svgEl('g', { cls: 'road-ghost' }, arr, box, txt, note), arr, box, txt, note };
}

function buildRoadwayDefs(ids: { readonly cid: string; readonly hid: string; readonly aid: string }, geom: { readonly padX: number; readonly padY: number; readonly rw: number; readonly rh: number }): SVGDefsElement {
  const defs = svgEl('defs', null, svgEl('clipPath', { id: ids.cid }, svgEl('rect', { x: geom.padX, y: geom.padY, width: geom.rw, height: geom.rh, rx: 8 })), svgEl('pattern', { id: ids.hid, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: 'rgba(180, 35, 24, 0.18)', 'stroke-width': 2 })));
  addArrowMarker(defs, ids.aid);
  return defs;
}

function initRoadwayScene(svgNode: SVGSVGElement, cfg: RoadwayConfig): RoadwayScene {
  const [boxW, boxH] = cfg.box;
  const padX = 8;
  const padY = 6;
  const rw = boxW - padX * 2;
  const rh = boxH - padY * 2;
  roadSeq += 1;
  const ids = { cid: `road-clip-${roadSeq}`, hid: `road-hatch-${roadSeq}`, aid: `road-arrow-${roadSeq}` };
  patchAttrs(svgNode, { viewBox: `0 0 ${boxW} ${boxH}`, width: boxW, height: boxH });
  const sx = linearScale([0, cfg.maxM], [padX + 22, padX + rw - 18], true);
  const sy = linearScale([-4, 4], [padY + rh * 0.88, padY + rh * 0.24]);
  const zones = { safe: svgEl('rect', { cls: 'road-safe', x: padX, y: padY, height: rh }), warn: svgEl('rect', { cls: 'road-warn', y: padY, height: rh }), crash: svgEl('rect', { cls: 'road-crash', y: padY, height: rh }), hatch: svgEl('rect', { y: padY, height: rh, fill: `url(#${ids.hid})` }) };
  const lane = { line: svgEl('line', { cls: 'road-divider', x1: padX + 8, x2: padX + rw - 8 }), adjLbl: svgEl('text', { cls: 'road-lane-lbl', x: padX + 8 }, 'Adj. Lane'), egoLbl: svgEl('text', { cls: 'road-lane-lbl', x: padX + 8 }, 'Ego Lane') };
  const curves = { safe: svgEl('path', { cls: 'viz-line is-teal' }), atk: svgEl('path', { cls: 'viz-line' }), impact: svgEl('circle', { cls: 'viz-impact-ring', r: 17 }) };
  const ghost = buildRoadwayGhost(ids.aid);
  const [obsG, obsTxt] = makeRoadCar('road-car is-obs', 28, 20);
  const [safeTagG] = makeRoadCar('road-car is-safe', 26, 16, 'SAFE');
  const [egoG] = makeRoadCar('road-car is-navy', 28, 18, 'EGO');
  const ticksG = svgEl('g', null, ...cfg.ticksM.map((m) => svgEl('text', { cls: 'road-tick', x: sx(m), y: padY + rh - 5, 'text-anchor': 'middle' }, `${m}m`)));
  const rootG = svgEl('g', { 'clip-path': `url(#${ids.cid})` }, zones.safe, zones.warn, zones.crash, zones.hatch, svgEl('text', { cls: 'road-zone-lbl is-teal', x: padX + 8, y: padY + 13 }, 'SAFE STOPPING ZONE'), svgEl('text', { cls: 'road-zone-lbl is-crimson', x: padX + rw - 8, y: padY + 13, 'text-anchor': 'end' }, 'CRASH ZONE'), lane.line, lane.adjLbl, lane.egoLbl, ticksG, curves.safe, curves.atk, curves.impact, ghost.grp, obsG, safeTagG, egoG);
  const setBadge = mountBadge(rootG);
  const border = svgEl('rect', { cls: 'road-border', x: padX, y: padY, width: rw, height: rh, rx: 8 });
  svgNode.append(buildRoadwayDefs(ids, { padX, padY, rw, rh }), rootG, border);
  return { boxW, padX, padY, rw, rh, sx, sy, lineGen: d3Line<StopPoint>().x((pt) => sx(pt.x)).y((pt) => sy(pt.y)).curve(monotoneX), zones, lane, curves, ghost, cars: { obsG, obsTxt, safeTagG, egoG }, setBadge, border };
}

function renderTrajectoryRoadway(scene: RoadwayScene, rd: TrajectoryRoadwayView, yEgo: number): void {
  patchAttrs(scene.curves.safe, { d: scene.lineGen(rd.safePath) ?? '' });
  setShow(scene.curves.atk, true);
  patchAttrs(scene.curves.atk, { cls: `viz-line is-dashed ${rd.crashed ? 'is-crimson' : 'is-blue'}`, d: scene.lineGen(rd.atkPath) ?? '' });
  setShow(scene.cars.safeTagG, false);
  setShow(scene.ghost.grp, false);
  patchAttrs(scene.cars.egoG, { cls: 'road-car is-navy', transform: `translate(${scene.sx(0)},${yEgo})` });
  if (rd.crashed) {
    const atkEnd = rd.atkPath[rd.atkPath.length - 1];
    const xHit = Math.min(atkEnd.x, rd.obsM);
    patchAttrs(scene.curves.impact, { cx: scene.sx(xHit), cy: clamp(scene.sy(yAtX(rd.atkPath, xHit)), scene.padY + 18, scene.padY + scene.rh - 18) });
  }
}

function renderEncounterRoadway(scene: RoadwayScene, rd: EncounterRoadwayView, coords: { readonly xObs: number; readonly yAdj: number; readonly yEgo: number }): void {
  const { xObs, yAdj, yEgo } = coords;
  const xSafeStop = Math.min(scene.sx(24.6), xObs - 42);
  const xSafeNow = Math.min(scene.sx(rd.safeStopM), xSafeStop);
  patchAttrs(scene.curves.safe, { d: `M${scene.sx(0)},${yEgo - 5}L${xSafeNow},${yEgo - 5}` });
  setShow(scene.cars.safeTagG, true);
  patchAttrs(scene.cars.safeTagG, { transform: `translate(${xSafeStop},${yEgo - 6})` });
  const xEgoPx = rd.egoM !== undefined ? Math.min(scene.sx(rd.egoM), rd.crashed ? xObs + 4 : xObs - 14) : xSafeNow;
  const showAtk = rd.atkStartM !== undefined && xEgoPx > scene.sx(rd.atkStartM);
  setShow(scene.curves.atk, showAtk);
  if (showAtk && rd.atkStartM !== undefined) {
    patchAttrs(scene.curves.atk, { cls: `viz-line is-dashed ${rd.crashed ? 'is-crimson' : 'is-orange'}`, d: `M${scene.sx(rd.atkStartM)},${yEgo + 4}L${xEgoPx},${yEgo + 4}` });
  }
  patchAttrs(scene.cars.egoG, { cls: `road-car is-${rd.egoTone}`, transform: `translate(${xEgoPx},${yEgo})` });
  const showGhost = rd.ghostFrac > 0.06;
  setShow(scene.ghost.grp, showGhost);
  if (showGhost) {
    const yGhost = lerp(yEgo, yAdj, rd.ghostFrac);
    const gx = xObs + 14;
    patchAttrs(scene.ghost.arr, { x1: gx, y1: yEgo - 11, x2: gx, y2: yGhost + 10 });
    patchAttrs(scene.ghost.box, { x: gx - 18, y: yGhost - 9 });
    patchAttrs(scene.ghost.txt, { x: gx, y: yGhost + 3 });
    patchAttrs(scene.ghost.note, { x: gx - 24, y: yGhost + 3 });
  }
  if (rd.crashed) {
    patchAttrs(scene.curves.impact, { cx: xObs, cy: yEgo });
  }
}

function updateRoadwayChrome(scene: RoadwayScene, rd: RoadwayView, twoLane: boolean, coords: { readonly xObs: number; readonly yAdj: number; readonly yDiv: number; readonly yEgo: number }): void {
  const xWarn = scene.sx(Math.max(0, rd.obsM - 3.5));
  const xEnd = scene.padX + scene.rw;
  patchAttrs(scene.zones.safe, { width: Math.max(0, xWarn - scene.padX) });
  patchAttrs(scene.zones.warn, { x: xWarn, width: Math.max(0, coords.xObs - xWarn) });
  patchAttrs(scene.zones.crash, { x: coords.xObs, width: Math.max(0, xEnd - coords.xObs), cls: rd.crashed ? 'road-crash is-hit' : 'road-crash' });
  patchAttrs(scene.zones.hatch, { x: coords.xObs, width: Math.max(0, xEnd - coords.xObs) });
  patchAttrs(scene.cars.obsG, { transform: `translate(${twoLane ? coords.xObs + 14 : coords.xObs},${coords.yEgo})` });
  setText(scene.cars.obsTxt, rd.obsLabel);
  patchAttrs(scene.lane.line, { y1: twoLane ? coords.yDiv : coords.yEgo, y2: twoLane ? coords.yDiv : coords.yEgo });
  setShow(scene.lane.adjLbl, twoLane);
  setShow(scene.lane.egoLbl, twoLane);
  patchAttrs(scene.lane.adjLbl, { y: coords.yAdj + 3 });
  patchAttrs(scene.lane.egoLbl, { y: coords.yEgo - 12 });
  patchAttrs(scene.border, { cls: rd.crashed ? 'road-border is-hit' : 'road-border' });
  setShow(scene.curves.impact, rd.crashed);
}

function createRoadway(svgNode: SVGSVGElement, cfg: RoadwayConfig): (rd: RoadwayView) => void {
  const scene = initRoadwayScene(svgNode, cfg);
  return (rd) => {
    const twoLane = rd.kind === 'encounter';
    const yAdj = scene.padY + scene.rh * 0.3;
    const yDiv = scene.padY + scene.rh * 0.5;
    const yEgo = twoLane ? scene.padY + scene.rh * 0.72 : scene.sy(0);
    const xObs = scene.sx(rd.obsM);
    updateRoadwayChrome(scene, rd, twoLane, { xObs, yAdj, yDiv, yEgo });
    if (rd.kind === 'trajectory') {
      renderTrajectoryRoadway(scene, rd, yEgo);
    } else if (rd.kind === 'encounter') {
      renderEncounterRoadway(scene, rd, { xObs, yAdj, yEgo });
    } else {
      assertNever(rd);
    }
    scene.setBadge(rd.badgeText, rd.badgeCls ?? (rd.crashed ? 'is-bad-solid' : 'is-good'), {
      minW: 146, maxW: 280, y: twoLane ? scene.padY + 4 : scene.padY + 18,
      x: (bw) => (twoLane ? clamp((scene.boxW - bw) * 0.5 - 24, scene.padX + 118, scene.padX + scene.rw - bw - 84) : scene.padX + 8),
    });
  };
}

// Figure 2: Bayesian Fault Injection (DriveFI)
type DfiMode = 'apollo' | 'driveav';
interface DfiCellEval {
  readonly r: number; readonly col: number; readonly name: string; readonly disabled: boolean;
  readonly gapHere: number; readonly masked: boolean; readonly cf: StopTrajectory;
  readonly dCf: number; readonly crash: boolean; readonly depart: boolean; readonly hazard: boolean; readonly latY: number;
}
interface DriveFiMatrixDom {
  readonly cellBtns: readonly HTMLButtonElement[]; readonly sumTitle: HTMLDivElement;
  readonly skipBar: HTMLProgressElement; readonly skipLbl: HTMLSpanElement; readonly runLbl: HTMLSpanElement;
}

const DFI_ROWS = [
  { id: 'Camera', name: 'Camera Detector', y: 46, delaySec: 0.44, accelDelay: 0.8, auxMasked: true },
  { id: 'LiDAR', name: 'LiDAR / Free-Space', y: 84, delaySec: 0.14, accelDelay: 0, auxMasked: true },
  { id: 'Fusion', name: 'Sensor Fusion', y: 122, delaySec: 0.58, accelDelay: 1.0, auxMasked: false },
  { id: 'Braking', name: 'Planner & Brakes', y: 160, delaySec: 0.66, accelDelay: 1.0, auxMasked: false },
] as const;
const DFI_COLS: readonly TopoHeaderDef[] = [
  { x: 58, y: 14, w: 80, label: 'Prev Frame' },
  { x: 157, y: 14, w: 84, label: 'Current Frame', cls: 'is-blue' },
  { x: 256, y: 14, w: 80, label: 'Next Frame' },
];
const EPOCH_OFF: readonly number[] = [13, 10, 7, 4, 0, -2];

function dfiRowTip(rowIdx: number): string {
  return `**${DFI_ROWS[rowIdx].name}**\nClick to perform counterfactual \`do(fault)\` surgery here.`;
}

const DFI_TOPO_NODES: readonly TopoNodeDef[] = DFI_COLS.flatMap((col, colIdx) =>
  DFI_ROWS.map((row, rowIdx): TopoNodeDef => ({ id: `${colIdx}-${rowIdx}`, kind: 'pill', x: col.x, y: row.y, w: 70, h: 23, label: row.id, click: colIdx === 1, cls: colIdx === 1 ? 'is-blue-ring' : 'is-slate', tip: colIdx === 1 ? dfiRowTip(rowIdx) : undefined })),
);
const DFI_TOPO_EDGES: readonly TopoEdgeDef[] = [
  ...range(2).flatMap((colIdx) => DFI_ROWS.map((row, rowIdx): TopoEdgeDef => ({ id: `h-${colIdx}-${rowIdx}`, d: `M${DFI_COLS[colIdx].x + 36},${row.y}L${DFI_COLS[colIdx + 1].x - 37},${row.y}`, lx: 0.5 * (DFI_COLS[colIdx].x + DFI_COLS[colIdx + 1].x), ly: row.y + 3.5, cls: 'is-muted' }))),
  ...DFI_COLS.flatMap((col, colIdx): readonly TopoEdgeDef[] => [
    { id: `v-cf-${colIdx}`, d: `M${col.x - 22},58 Q${col.x - 48},84 ${col.x - 22},110`, lx: col.x - 36, ly: 87, cls: 'is-muted' },
    { id: `v-lf-${colIdx}`, d: `M${col.x + 10},96L${col.x + 10},110`, lx: col.x + 10, ly: 106, cls: 'is-muted' },
    { id: `v-fb-${colIdx}`, d: `M${col.x},134L${col.x},148`, lx: col.x, ly: 144, cls: 'is-muted' },
  ]),
];

const DFI_SPEC: FigureSpec<DfiMode> = {
  kicker: 'Figure 2 · Bayesian Fault Injection (DriveFI) · Counterfactual Graph Surgery and Kinematic Emergency-Stop Screening',
  modes: [{ id: 'apollo', label: 'Camera-Primary Stack', active: true }, { id: 'driveav', label: '+ Parallel LiDAR / Free-Space' }],
  legend: [
    { kind: 'swatch', tone: 'crimson', label: 'Injected fault & CRASH zone' },
    { kind: 'swatch', tone: 'teal', label: 'Safe stopping zone' },
    { kind: 'swatch', tone: 'amber', label: 'Tight braking buffer' },
    { kind: 'swatch', tone: 'slate', label: 'Skipped trial (masked offline)' },
  ],
  grid: 'is-2col',
  panels: [
    { kind: 'plot', title: '1. TEMPORAL BAYESIAN NETWORK (CLICK CURRENT MODULE)', svgId: 'svg-av-drivefi-1' },
    { kind: 'plot', title: '2. KINEMATIC EMERGENCY-STOP SOLVER & CRASH ZONE', svgId: 'svg-av-drivefi-2' },
    { kind: 'plot', cls: 'is-span-all', title: '3. CAMPAIGN FILTER MATRIX (CLICK TRIAL CELL TO INSPECT)', mountId: 'dfi-bottom-mount', mountCls: 'dfi-bottom' },
  ],
  sliders: [
    { key: 'gap', label: 'Initial distance to obstacle', min: 19, max: 33, step: 1, value: 21, fmt: (v) => `${Math.round(v)} m` },
    { key: 'phi', label: 'Initial steering angle', min: -0.14, max: 0.14, step: 0.02, value: 0.04, fmt: (rad) => `${fmtSigned((rad * 180) / Math.PI, 1)}°` },
  ],
  metrics: [{ key: 'fault', label: 'Injected fault' }, { key: 'outcome', label: 'Predicted outcome' }, { key: 'speedup', label: 'Campaign speedup' }],
};

const memoStopTraj = memoBy((phi0: number, hasAux: boolean): { readonly nom: StopTrajectory; readonly cfs: readonly StopTrajectory[] } => ({
  nom: integrateBicycleStop({ v0: 14.5, phi0, aMax: 6.8, delaySec: 0.08, accelDelay: 0 }),
  cfs: DFI_ROWS.map((row) => {
    const masked = row.id === 'LiDAR' || (row.auxMasked && hasAux);
    return integrateBicycleStop({ v0: 14.5, phi0, aMax: 6.8, delaySec: masked ? 0.14 : row.delaySec, accelDelay: masked ? 0 : row.accelDelay });
  }),
}));

function evaluateDriveFiGrid(gap: number, hasAux: boolean, cfs: readonly StopTrajectory[]): ReadonlyArray<readonly DfiCellEval[]> {
  return DFI_ROWS.map((row, rowIdx) =>
    EPOCH_OFF.map((off, colIdx): DfiCellEval => {
      const disabled = rowIdx === 1 && !hasAux;
      const gapHere = clamp(gap + off, 17, 36);
      const masked = row.id === 'LiDAR' || (row.auxMasked && hasAux);
      const cf = cfs[rowIdx];
      const dCf = gapHere - cf.xStop;
      const crash = dCf <= 0;
      const latY = Math.abs(yAtX(cf.pts, gapHere));
      const depart = !masked && !crash && latY > 5.2;
      return { r: rowIdx, col: colIdx, name: row.name, disabled, gapHere, masked, cf, dCf, crash, depart, hazard: crash || depart, latY };
    }),
  );
}

function updateDriveFiCellsDom(cells: readonly DfiCellEval[], cellBtns: readonly HTMLButtonElement[], selRow: number, selCol: number): void {
  for (const [idx, cell] of cells.entries()) {
    const btn = cellBtns[idx];
    const isSel = !cell.disabled && cell.r === selRow && cell.col === selCol;
    btn.disabled = cell.disabled;
    const marginDesc = cell.depart ? `Lateral drift: ${cell.latY.toFixed(1)} m` : `Margin: ${fmtSigned(cell.dCf, 1, ' m')}`;
    patchAttrs(btn, {
      cls: `dfi-cell${cell.disabled ? ' is-disabled' : cell.hazard ? ' is-run' : ''}${isSel ? ' is-sel' : ''}`,
      'aria-pressed': String(isSel),
      'aria-label': `${cell.name} frame ${cell.col + 1}: ${cell.disabled ? 'disabled' : cell.hazard ? 'Run 3D simulator' : 'Skip trial'}`,
      'data-tip': cell.disabled ? null : `**${cell.name} · Frame ${cell.col + 1}**\nObstacle gap: ${cell.gapHere} m · ${marginDesc} → **${cell.hazard ? 'Run 3D Simulator' : 'Skip (Masked Offline)'}**`,
    });
    setText(btn, cell.disabled ? '' : cell.hazard ? 'RUN' : 'SKIP');
  }
}

function makeDfiEdgePatch(severed: boolean, affected: boolean, show = true): EdgePatch {
  return { show, cls: severed ? 'is-crimson is-dashed is-faint' : affected ? 'is-crimson' : 'is-muted', arrow: !severed, label: severed ? '✕' : '' };
}

function makeDfiNodePatch(colIdx: number, rowIdx: number, selRow: number, flags: { readonly hasAux: boolean; readonly curMasked: boolean }): NodePatch {
  const row = DFI_ROWS[rowIdx];
  const disabled = rowIdx === 1 && !flags.hasAux;
  const isDo = colIdx === 1 && rowIdx === selRow;
  const corrupted = isDo || (colIdx >= 1 && rowIdx > selRow && !(rowIdx >= 2 && flags.curMasked)) || (colIdx === 2 && rowIdx === selRow);
  return {
    label: isDo ? `✕ ${row.id}` : row.id, clickable: colIdx === 1 && !disabled, pressed: colIdx === 1 && !disabled ? isDo : null,
    ariaLabel: colIdx === 1 ? `${row.name}${isDo ? ' (injected fault)' : ''}` : undefined,
    tip: colIdx === 1 ? (disabled ? null : dfiRowTip(rowIdx)) : undefined,
    cls: disabled ? 'is-dim' : isDo ? 'is-fault' : corrupted ? 'is-warn' : colIdx === 1 ? 'is-blue-ring' : 'is-slate',
  };
}

function buildDriveFiTopoPatch(selRow: number, hasAux: boolean, curMasked: boolean): TopoPatch {
  const nodes = Object.fromEntries(range(3).flatMap((c) => range(4).map((r) => [`${c}-${r}`, makeDfiNodePatch(c, r, selRow, { hasAux, curMasked })] as const)));
  const edges = Object.fromEntries([
    ...range(2).flatMap((c) => range(4).map((r) => [`h-${c}-${r}`, makeDfiEdgePatch(c === 0 && r === selRow, c === 1 && (r === selRow || (r >= 2 && r >= selRow && !curMasked)), !(r === 1 && !hasAux))] as const)),
    ...range(3).flatMap((c) => [
      [`v-cf-${c}`, makeDfiEdgePatch(c === 1 && selRow === 2, c >= 1 && selRow === 0)] as const,
      [`v-lf-${c}`, makeDfiEdgePatch(c === 1 && selRow === 2, c === 1 && selRow === 1, hasAux)] as const,
      [`v-fb-${c}`, makeDfiEdgePatch(c === 1 && selRow === 3, c >= 1 && !curMasked && selRow <= 2)] as const,
    ]),
  ]);
  return { nodes, edges };
}

function buildDriveFiTopoConfig(onSelectRow: (rowIdx: number) => void): TopoConfig {
  return {
    box: [310, 184], headers: DFI_COLS, nodes: DFI_TOPO_NODES, edges: DFI_TOPO_EDGES,
    onNodeClick: (id) => {
      const [colIdx, rowIdx] = id.split('-').map(Number);
      if (Number.isInteger(colIdx) && Number.isInteger(rowIdx) && colIdx === 1 && rowIdx >= 0 && rowIdx < DFI_ROWS.length) {
        onSelectRow(rowIdx);
      }
    },
  };
}

function buildDriveFiMatrixDom(mountEl: HTMLElement, onSelectCell: (rowIdx: number, colIdx: number) => void): DriveFiMatrixDom {
  const cellBtns = DFI_ROWS.flatMap((_, rowIdx) => EPOCH_OFF.map((_off, colIdx) => h('button', { type: 'button', cls: 'dfi-cell', 'data-r': rowIdx, 'data-c': colIdx })));
  const gridEl = h('div', {
    cls: 'dfi-grid',
    onClick: (event: Event) => {
      const btn = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button.dfi-cell') : null;
      const nextRow = btn && !btn.disabled ? Number(btn.dataset['r']) : NaN;
      const nextCol = btn && !btn.disabled ? Number(btn.dataset['c']) : NaN;
      if (Number.isInteger(nextRow) && Number.isInteger(nextCol) && nextRow >= 0 && nextRow < DFI_ROWS.length && nextCol >= 0 && nextCol < EPOCH_OFF.length) {
        onSelectCell(nextRow, nextCol);
      }
    },
  }, ...cellBtns);
  const sumTitle = h('div', { cls: 'viz-card-title viz-ellipsis' });
  const skipBar = h('progress', { cls: 'progress is-teal is-track-crimson', max: 18, value: 10 });
  const skipLbl = h('span', null);
  const runLbl = h('span', { cls: 'is-crimson' });
  mountEl.replaceChildren(
    h('div', { cls: 'dfi-matrix-wrap' }, h('div', { cls: 'dfi-row-lbls' }, ...DFI_ROWS.map((row) => h('span', null, row.id))), gridEl),
    h('div', { cls: 'viz-card' }, sumTitle, skipBar, h('div', { cls: 'viz-row-hd viz-mono is-teal' }, skipLbl, runLbl)),
  );
  return { cellBtns, sumTitle, skipBar, skipLbl, runLbl };
}

function updateDriveFiSummary(ctx: MountHandle<DfiMode>, dom: DriveFiMatrixDom, cur: DfiCellEval, stats: { readonly skipped: number; readonly crit: number; readonly total: number }): void {
  const skipPct = Math.round((stats.skipped / Math.max(1, stats.total)) * 100);
  ctx.setMetric('fault', `${cur.name} (${cur.gapHere.toFixed(0)} m gap)`, 'is-blue');
  ctx.setMetric('outcome', matchRule([[cur.crash, `CRASH! (${Math.abs(cur.dCf).toFixed(1)} m · Run 3D Sim)`], [cur.depart, `LANE DEPART! (${cur.latY.toFixed(1)} m · Run 3D Sim)`]], `${cur.masked ? 'Masked' : 'Safe'} (${fmtSigned(cur.dCf, 1, ' m')} · Skip Sim)`), cur.hazard ? 'is-crimson' : 'is-teal');
  ctx.setMetric('speedup', `${stats.skipped}/${stats.total} skipped (${skipPct}% saved)`, 'is-teal');
  setText(dom.sumTitle, `DriveFI Campaign Filter: ${skipPct}% Simulator Runs Saved`);
  patchAttrs(dom.skipBar, { max: stats.total, value: stats.skipped });
  setText(dom.skipLbl, `Skipped (Masked): ${stats.skipped}/${stats.total}`);
  setText(dom.runLbl, `3D Simulator Runs: ${stats.crit}/${stats.total}`);
}

function renderDriveFiView(
  ctx: MountHandle<DfiMode>, sel: { readonly row: number; readonly col: number },
  views: { readonly matrixDom: DriveFiMatrixDom; readonly patchTopo: (patch: TopoPatch) => void; readonly drawRoadway: (rd: RoadwayView) => void },
): void {
  const hasAux = ctx.mode() === 'driveav';
  const { nom, cfs } = memoStopTraj(ctx.num('phi'), hasAux);
  const grid = evaluateDriveFiGrid(ctx.num('gap'), hasAux, cfs);
  const cur = grid[sel.row][sel.col];
  const cells = grid.flat();
  const active = cells.filter((cell) => !cell.disabled);
  const crit = active.filter((cell) => cell.hazard).length;
  updateDriveFiSummary(ctx, views.matrixDom, cur, { skipped: active.length - crit, crit, total: active.length });
  updateDriveFiCellsDom(cells, views.matrixDom.cellBtns, sel.row, sel.col);
  views.patchTopo(buildDriveFiTopoPatch(sel.row, hasAux, cur.masked));
  views.drawRoadway({
    kind: 'trajectory', obsM: cur.gapHere, obsLabel: 'OBS', crashed: cur.hazard,
    badgeText: matchRule([[cur.crash, `CRASH! (${Math.abs(cur.dCf).toFixed(1)} m overrun)`], [cur.depart, `LANE DEPARTURE! (${cur.latY.toFixed(1)} m drift)`]], `${cur.masked ? 'MASKED · SAFE' : 'SAFE STOP'} (${fmtSigned(cur.dCf, 1, ' m')})`),
    safePath: nom.pts, atkPath: cur.cf.pts,
  });
}

mountFigure('av-drivefi', DFI_SPEC, (ctx) => {
  let sel = { row: 2, col: 4 };
  const drawRoadway = createRoadway(ctx.svg('svg-av-drivefi-2'), { box: [324, 182], maxM: 36, ticksM: [0, 10, 20, 30] });
  const matrixDom = buildDriveFiMatrixDom(ctx.el('dfi-bottom-mount'), (row, col) => {
    sel = { row, col };
    renderDriveFiView(ctx, sel, { matrixDom, patchTopo, drawRoadway });
  });
  const patchTopo = renderTopo(ctx.svg('svg-av-drivefi-1'), buildDriveFiTopoConfig((row) => {
    if (!(row === 1 && ctx.mode() === 'apollo')) {
      sel = { ...sel, row };
      renderDriveFiView(ctx, sel, { matrixDom, patchTopo, drawRoadway });
    }
  }));
  return {
    onCtrl: () => {
      if (ctx.mode() === 'apollo' && sel.row === 1) {
        sel = { ...sel, row: 0 };
      }
    },
    render: () => {
      renderDriveFiView(ctx, sel, { matrixDom, patchTopo, drawRoadway });
    },
  };
});
