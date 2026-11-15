/**
 * @fileoverview Interactive figures and colocated statistical, vehicle-kinematics,
 * and Kalman-estimation models for the Autonomous Vehicle Resilience project
 * page (`av`).
 */

import { clamp, createRng, h, matchRule, memoBy, mountFigure, patchAttrs, range, setText, svgEl, type FigureSpec, type MountHandle, type Rng } from '../lib/engine';
import { bindDrag, createChart, type ChartHandle } from '../lib/layers';

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
