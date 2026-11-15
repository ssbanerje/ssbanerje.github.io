/**
 * @fileoverview Interactive figures for the Intelligence-Augmented Computer
 * Systems project page (`learnedsystems`).
 */

import d3Area from 'd3-shape/area';
import d3Line from 'd3-shape/line';
import { monotoneX } from 'd3-shape/monotone';
import { clamp, createRng, h, iterate, lerp, matchRule, maxIndex, mean, memoBy, mountFigure, patchAttrs, pushRing, range, setText, sum, svgEl, toRecord, type FigureSpec, type MountHandle, type Rng } from '../lib/engine';
import { createChart, rayEdge, renderTopo, type EdgePatch, type TopoConfig, type TopoEdgeDef, type TopoNodeDef, type TopoPatch } from '../lib/layers';

// Figure 1: Heterogeneous Accelerator Scheduling (Symphony)
type LoopMode = 'greybox' | 'point' | 'blackbox';
interface PlotPoint { readonly x: number; readonly y: number }
interface LoopSample {
  readonly trueLoad: number; readonly obsLoad: number; readonly muxGap: boolean;
  readonly mean: number; readonly upper: number; readonly lower: number;
  readonly deferred: Record<LoopMode, boolean>; readonly queueMs: Record<LoopMode, number>;
}
interface LoopSimState {
  readonly ep: number; readonly mu: number; readonly variance: number;
  readonly queue: Record<LoopMode, number>; readonly hist: readonly LoopSample[];
}
interface LoopSummary {
  readonly activeQueueMs: readonly number[]; readonly obsPts: readonly PlotPoint[];
  readonly p99Disp: number; readonly withinSlo: boolean; readonly deferText: string; readonly jitterText: string;
}

const LOOP_CFG = { nHist: 76, tauDma: 0.7, sloMs: 26, seed: 0.13572468 } as const;
const LOOP_META: Record<LoopMode, { readonly est: string; readonly sub: string; readonly lineCls: string; readonly pmCls: string }> = {
  greybox: { est: 'Backpressure BN (Upper Bound)', sub: 'Posterior Credible Interval', lineCls: 'is-blue', pmCls: 'is-blue' },
  point: { est: 'BN Posterior Mean Only', sub: 'Posterior Mean Only', lineCls: 'is-amber', pmCls: 'is-amber' },
  blackbox: { est: 'Raw Multiplexed Counters', sub: 'Bypassed', lineCls: 'is-crimson', pmCls: 'is-dim' },
};

const LOOP_SPEC: FigureSpec<LoopMode> = {
  kicker: 'Figure 1 · Heterogeneous Accelerator Scheduling (Symphony) · Posterior Credible Bounds Under Partial Observability',
  modes: [
    { id: 'greybox', label: 'Arch-Guided (Upper Bound)', active: true },
    { id: 'point', label: 'Point Est. (Mean Only)' },
    { id: 'blackbox', label: 'Black-Box (Raw Telemetry)' },
  ],
  actions: ['step', 'play'], stepMs: 135,
  legend: [
    { kind: 'line', tone: 'navy', label: 'True PCIe load' },
    { kind: 'dot', tone: 'slate', label: 'Multiplexed telemetry' },
    { kind: 'band', tone: 'blue', label: 'Posterior credible interval' },
    { kind: 'swatch', tone: 'amber', label: 'Upper-bound `No-Op` deferral' },
    { kind: 'line', tone: 'crimson', label: 'DMA queue stall / overflow' },
  ],
  grid: 'is-2col-asym',
  panels: [
    { kind: 'plot', title: 'CLOSED-LOOP CONTROL ARCHITECTURE', svgId: 'svg-ls-loop-a' },
    { kind: 'plot', cls: 'is-stack', subpanels: [{ title: 'PCIE INTERCONNECT LOAD & POSTERIOR CREDIBLE INTERVAL', svgId: 'svg-ls-loop-b1' }, { title: 'RESULTING P99 DMA QUEUE LATENCY (MS)', svgId: 'svg-ls-loop-b2' }] },
  ],
  sliders: [
    { key: 'noise', label: 'Telemetry multiplexing noise', min: 0.1, max: 0.6, step: 0.02, value: 0.34, fmt: (v) => v.toFixed(2) },
    { key: 'phase', label: 'DMA burst intensity', min: 0.55, max: 1.25, step: 0.05, value: 0.95, fmt: (v) => `${v.toFixed(2)}×` },
  ],
  metrics: [{ key: 'est', label: 'Policy input' }, { key: 'defers', label: 'No-Op deferrals' }, { key: 'q99', label: 'P99 DMA latency' }, { key: 'jitter', label: 'Migration thrash' }],
};

const LOOP_TOPO: TopoConfig = {
  box: [264, 232],
  nodes: [
    { id: 'plant', kind: 'card', x: 72, y: 12, w: 120, h: 42, label: 'Accelerator Node', sub: 'CPU/GPU/FPGA + PCIe', cls: 'is-navy', focusable: true, tip: '**Accelerator Node**\nHeterogeneous CPU/GPU/FPGA sharing PCIe interconnect.' },
    { id: 'obs', kind: 'card', x: 138, y: 98, w: 120, h: 42, label: 'Endpoint Telemetry', sub: '32 Multiplexed Monitors', cls: 'is-slate', focusable: true, tip: '**Endpoint Telemetry**\nTime-multiplexed hardware and driver counters with burst aliasing.' },
    { id: 'pm', kind: 'card', x: 66, y: 178, w: 132, h: 42, label: 'Backpressure BN', sub: 'Posterior Credible Interval', cls: 'is-blue', focusable: true, tip: '**Backpressure BN**\n68-node Bayesian network inferring posterior mean and credible bounds.' },
    { id: 'pol', kind: 'card', x: 6, y: 98, w: 118, h: 42, label: 'Learned Policy', sub: 'Dispatch / No-Op Defer', cls: 'is-orange', focusable: true, tip: '**Learned Policy**\nCompact scheduler deferring DMA transfers before queue saturation.' },
  ],
  edges: [
    { id: 'e1', d: 'M192,33 L206,33 L206,96', cls: 'is-slate is-flowing' },
    { id: 'e2', d: 'M206,140 L206,199 L200,199', cls: 'is-blue is-flowing' },
    { id: 'e3', d: 'M66,199 L52,199 L52,142', cls: 'is-blue is-flowing' },
    { id: 'eb', d: 'M138,119 L126,119', cls: 'is-crimson is-dashed', lx: 132, ly: 91, label: 'raw bypass', show: false },
    { id: 'e4', d: 'M52,98 L52,33 L70,33', cls: 'is-orange is-flowing' },
  ],
};

function nextLoopQueues(prevQueue: Record<LoopMode, number>, trueLoad: number, thrash: number, deferred: Record<LoopMode, boolean>): Record<LoopMode, number> {
  const congested = trueLoad >= LOOP_CFG.tauDma - 0.03;
  return {
    greybox: clamp(deferred.greybox ? lerp(prevQueue.greybox, 13.5 + 5 * trueLoad, 0.42) : congested ? prevQueue.greybox + 14.5 : lerp(prevQueue.greybox, 11 + 7.5 * trueLoad, 0.38), 9, 58),
    point: clamp(deferred.point ? lerp(prevQueue.point, 13.5 + 5 * trueLoad, 0.4) : congested ? prevQueue.point + 17.5 : lerp(prevQueue.point, 11.2 + 7.8 * trueLoad, 0.36), 9, 58),
    blackbox: clamp(deferred.blackbox ? lerp(prevQueue.blackbox, 16.5 + thrash, 0.35) : congested ? prevQueue.blackbox + 20 + thrash * 0.5 : lerp(prevQueue.blackbox, 13 + 8.5 * trueLoad + thrash, 0.35), 9, 58),
  };
}

function stepLoopSim(state: LoopSimState, noise: number, phase: number, rng: Rng): LoopSimState {
  const ep = state.ep + 1;
  const u = ep * 0.13;
  const muxGap = ep % 5 < 2;
  const burstTerm = Math.max(0, Math.sin(u * 1.55 - 0.5)) ** 2;
  const trueLoad = clamp(0.42 + 0.22 * phase * Math.sin(u * 0.72) + 0.24 * phase * burstTerm, 0.1, 0.94);
  const spike = (ep % 9 === 3 ? 0.25 : ep % 11 === 6 ? -0.21 : 0) * (noise / 0.34);
  const obsLoad = clamp(trueLoad + rng.gauss() * noise * 0.44 + spike, 0.03, 0.98);
  const prev = state.hist[state.hist.length - 1];
  const innov = !muxGap && prev ? Math.abs(obsLoad - prev.obsLoad) : 0.03;
  const predV = state.variance + 0.0028 + 0.08 * innov + (muxGap ? 0.0065 : 0.0012);
  const kalmanK = predV / (predV + noise * noise * (muxGap ? 0.95 : 0.38) + 0.004);
  const postMean = clamp(state.mu + kalmanK * ((muxGap ? lerp(state.mu, obsLoad, 0.55) : obsLoad) - state.mu), 0.06, 0.95);
  const variance = clamp((1 - kalmanK * (muxGap ? 0.55 : 1)) * predV, 0.0018, 0.022);
  const sig = Math.sqrt(variance);
  const upper = clamp(postMean + 2 * sig, 0.08, 0.99);
  const deferred: Record<LoopMode, boolean> = { greybox: upper >= LOOP_CFG.tauDma, point: postMean >= LOOP_CFG.tauDma, blackbox: obsLoad >= LOOP_CFG.tauDma };
  const thrash = Math.abs(obsLoad - (prev ? prev.obsLoad : obsLoad)) * 22;
  const queueMs = nextLoopQueues(state.queue, trueLoad, thrash, deferred);
  const sample: LoopSample = { trueLoad, obsLoad, muxGap, mean: postMean, upper, lower: clamp(postMean - 2 * sig, 0.02, 0.95), deferred, queueMs };
  return { ep, mu: postMean, variance, queue: queueMs, hist: pushRing(state.hist, sample, LOOP_CFG.nHist) };
}

function summarizeLoopHistory(hist: readonly LoopSample[], mode: LoopMode): LoopSummary {
  const activeQueueMs = hist.map((s) => s.queueMs[mode]);
  const sorted = [...activeQueueMs].sort((a, b) => a - b);
  const n = sorted.length;
  const p99 = n >= 2 ? lerp(sorted[n - 2], sorted[n - 1], 0.99 * (n - 1) - (n - 2)) : (sorted[0] ?? 0);
  const p99Disp = Math.round(p99 * 10) / 10;
  const withinSlo = p99Disp <= LOOP_CFG.sloMs;
  const defers = sum(hist, (s) => (s.deferred[mode] ? 1 : 0));
  const preCliff = sum(hist, (s) => (s.deferred[mode] && s.mean < LOOP_CFG.tauDma ? 1 : 0));
  const flips = sum(hist, (s, i) => (i > 0 && s.deferred[mode] !== hist[i - 1].deferred[mode] ? 1 : 0));
  const deferNotes: Record<LoopMode, string> = { greybox: `${preCliff} pre-cliff`, point: withinSlo ? 'within SLO' : 'misses mux bursts', blackbox: 'unstable thrashing' };
  return {
    activeQueueMs, obsPts: hist.flatMap((s, x) => (s.muxGap ? [] : [{ x, y: s.obsLoad }])),
    p99Disp, withinSlo, deferText: `${defers} deferrals (${deferNotes[mode]})`, jitterText: (flips / Math.max(1, n - 1)).toFixed(2),
  };
}

function initLoopCharts(ctx: MountHandle<LoopMode>): (hist: readonly LoopSample[], summary: LoopSummary, mode: LoopMode) => void {
  const loadChart = createChart(ctx.svg('svg-ls-loop-b1'), { box: [360, 108], pad: [6, 8, 8, 8], x: [0, LOOP_CFG.nHist - 1], y: [0, 1] });
  loadChart.hband(LOOP_CFG.tauDma, 1, 'is-crimson');
  const deferCols = loadChart.cols<LoopSample>(1, (_, idx) => idx - 0.5);
  loadChart.hrule({ y: LOOP_CFG.tauDma, cls: 'is-crimson is-dashed', label: 'DMA Saturation Threshold' });
  const ciArea = loadChart.area<LoopSample>((_, idx) => idx, (d) => d.lower, (d) => d.upper, 'is-blue');
  const upLine = loadChart.line<LoopSample>((_, idx) => idx, (d) => d.upper, 'is-blue is-dashed is-thin');
  const obsDots = loadChart.dots<PlotPoint>({ radius: 1.8, x: (pt) => pt.x, y: (pt) => pt.y, cls: 'is-slate' });
  const trueLine = loadChart.line<LoopSample>((_, idx) => idx, (d) => d.trueLoad, 'is-navy');
  const muLine = loadChart.line<LoopSample>((_, idx) => idx, (d) => d.mean, 'is-blue');
  const queueChart = createChart(ctx.svg('svg-ls-loop-b2'), { box: [360, 96], pad: [6, 8, 8, 8], x: [0, LOOP_CFG.nHist - 1], y: [0, 60] });
  queueChart.hband(LOOP_CFG.sloMs, 60, 'is-crimson');
  queueChart.hrule({ y: LOOP_CFG.sloMs, cls: 'is-crimson is-dashed', label: `Queue Stall SLO (${LOOP_CFG.sloMs} ms)` });
  const refQueueLine = queueChart.line<LoopSample>((_, idx) => idx, (d) => d.queueMs.greybox, 'is-blue is-dashed is-faint');
  const activeQueueLine = queueChart.line<number>((_, idx) => idx, (q) => q, 'is-teal');

  return (hist, summary, mode) => {
    deferCols(hist, (d) => (mode === 'greybox' && d.deferred.greybox && d.mean < LOOP_CFG.tauDma ? 'is-amber' : 'is-empty'));
    ciArea(hist, 'is-blue', mode === 'greybox');
    upLine(hist, 'is-blue is-dashed is-thin', mode === 'greybox');
    obsDots(summary.obsPts);
    trueLine(hist);
    muLine(hist, LOOP_META[mode].lineCls, mode !== 'blackbox');
    refQueueLine(hist, 'is-blue is-dashed is-faint', mode !== 'greybox');
    activeQueueLine(summary.activeQueueMs, mode === 'greybox' ? 'is-teal' : !summary.withinSlo ? 'is-crimson' : 'is-amber');
  };
}

function buildLoopRenderer(ctx: MountHandle<LoopMode>): (hist: readonly LoopSample[], mode: LoopMode) => void {
  const patchTopo = renderTopo(ctx.svg('svg-ls-loop-a'), LOOP_TOPO);
  const drawCharts = initLoopCharts(ctx);
  return (hist, mode) => {
    const meta = LOOP_META[mode];
    const modelOn = mode !== 'blackbox';
    const summary = summarizeLoopHistory(hist, mode);
    ctx.setMetric('est', meta.est, 'is-blue');
    ctx.setMetric('defers', summary.deferText);
    ctx.setMetric('q99', `${summary.p99Disp.toFixed(1)} ms (${summary.withinSlo ? 'Within SLO' : 'DMA Stall Overflow!'})`, summary.withinSlo ? 'is-teal' : 'is-crimson');
    ctx.setMetric('jitter', summary.jitterText);
    patchTopo({
      nodes: { pm: { sub: meta.sub, cls: meta.pmCls } },
      edges: { e2: { show: modelOn, cls: `${meta.lineCls} is-flowing` }, e3: { show: modelOn, cls: `${meta.lineCls} is-flowing` }, eb: { show: !modelOn } },
    });
    drawCharts(hist, summary, mode);
  };
}

mountFigure('ls-loop', LOOP_SPEC, (ctx) => {
  let rng = createRng(LOOP_CFG.seed);
  function initSim(): LoopSimState {
    rng = createRng(LOOP_CFG.seed);
    const seed: LoopSimState = { ep: 0, mu: 0.42, variance: 0.012, queue: { greybox: 11, point: 11, blackbox: 14 }, hist: [] };
    return iterate(LOOP_CFG.nHist, seed, (s) => stepLoopSim(s, ctx.num('noise'), ctx.num('phase'), rng));
  }
  let simState = initSim();
  const drawLoop = buildLoopRenderer(ctx);
  return {
    step: () => {
      simState = stepLoopSim(simState, ctx.num('noise'), ctx.num('phase'), rng);
    },
    onCtrl: (key) => {
      if (!ctx.isPlaying() && (key === 'noise' || key === 'phase')) {
        simState = initSim();
      }
    },
    render: () => {
      drawLoop(simState.hist, ctx.mode());
    },
  };
});

// Figure 2: Cloud Microservices (FIRM)
interface ServiceSpec { readonly id: string; readonly name: string; readonly res: string; readonly base: number; readonly weights: readonly [number, number, number]; readonly x: number; readonly y: number }
interface RpcPath { readonly nodes: readonly number[]; readonly edges: readonly string[] }
interface FirmParams { readonly closedLoop: boolean; readonly contention: number; readonly burstLoad: number }
interface FirmState {
  readonly victim: number; readonly timeSec: number; readonly ways: number; readonly mba: number;
  readonly cpu: number; readonly ms: readonly number[]; readonly cp: RpcPath; readonly hist: readonly number[];
}
interface FirmIsoDom {
  readonly banner: HTMLDivElement; readonly bannerTitle: HTMLDivElement; readonly bannerSub: HTMLDivElement;
  readonly waysVal: HTMLSpanElement; readonly wayCells: readonly HTMLSpanElement[]; readonly waysNote: HTMLDivElement;
  readonly mbaVal: HTMLSpanElement; readonly mbaBar: HTMLProgressElement;
  readonly cpuVal: HTMLSpanElement; readonly cpuBar: HTMLProgressElement; readonly foot: HTMLDivElement;
}

const FIRM_CFG = { nHist: 54, sloMs: 100, waysMax: 12 } as const;
const SVCS: readonly ServiceSpec[] = [
  { id: 'FE', name: 'Frontend', res: 'LLC + CPU', base: 9, weights: [0.85, 0.25, 0.95], x: 34, y: 98 },
  { id: 'Auth', name: 'Auth', res: 'LLC Ways', base: 11, weights: [1.15, 0.25, 0.2], x: 114, y: 36 },
  { id: 'Srch', name: 'Search', res: 'LLC + MemBW', base: 18, weights: [0.95, 0.95, 0.25], x: 114, y: 98 },
  { id: 'Rec', name: 'Recommend', res: 'CPU Compute', base: 24, weights: [0.25, 0.2, 1.35], x: 114, y: 160 },
  { id: 'Cache', name: 'Memcached', res: 'LLC Ways', base: 12, weights: [1.15, 0.3, 0.2], x: 194, y: 66 },
  { id: 'DB', name: 'StorageDB', res: 'MemBW + I/O', base: 16, weights: [0.4, 1.15, 0.25], x: 194, y: 134 },
];
const RPC_LINKS: ReadonlyArray<readonly [number, number]> = [[0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [2, 5]];
const RPC_PATHS: readonly RpcPath[] = [
  { nodes: [0, 1, 4], edges: ['0-1', '1-4'] }, { nodes: [0, 2, 4], edges: ['0-2', '2-4'] },
  { nodes: [0, 2, 5], edges: ['0-2', '2-5'] }, { nodes: [0, 3], edges: ['0-3'] },
];

const FIRM_SPEC: FigureSpec = {
  kicker: 'Figure 2 · Cloud Microservices (FIRM) · Critical-Path Localization and Fine-Grained Resource Isolation',
  toggles: [{ key: 'closedLoop', label: 'FIRM Loop', on: true }],
  actions: ['play'], stepMs: 120,
  legend: [
    { kind: 'line', tone: 'crimson', label: 'Active critical path' },
    { kind: 'swatch', tone: 'blue', label: 'Learned resource allocation (cache / memory / CPU)' },
    { kind: 'line', tone: 'blue', label: 'End-to-end P99 latency' },
    { kind: 'line', tone: 'crimson', dashed: true, label: 'SLO deadline (100 ms)' },
  ],
  grid: 'is-3col',
  panels: [
    { kind: 'plot', title: '1. RPC GRAPH (CLICK NODE TO CONTEND)', svgId: 'svg-ls-firm-1' },
    { kind: 'plot', title: '2. FINE-GRAINED RESOURCE ISOLATION', mountId: 'firm-iso', mountCls: 'viz-card is-fill' },
    { kind: 'plot', title: '3. END-TO-END TAIL LATENCY (P99)', svgId: 'svg-ls-firm-3' },
  ],
  sliders: [
    { key: 'contention', label: 'Co-located cache / memory contention', min: 0.15, max: 0.95, step: 0.05, value: 0.7, fmt: (v) => v.toFixed(2) },
    { key: 'burstLoad', label: 'Request burst load', min: 0.2, max: 0.95, step: 0.05, value: 0.6, fmt: (v) => v.toFixed(2) },
  ],
  metrics: [{ key: 'bottleneck', label: 'Critical bottleneck' }, { key: 'actuation', label: 'Resource actuation' }, { key: 'p99', label: 'End-to-end P99' }],
};

function calcFirmServiceMs(alloc: { readonly ways: number; readonly mba: number; readonly cpu: number }, victim: number, params: FirmParams): number[] {
  const [wLlc, wMba, wCpu] = SVCS[victim].weights;
  const llcDef = Math.max(0, 4 + 6.5 * params.contention - alloc.ways) * 7.5 * wLlc;
  const mbaDef = Math.max(0, 38 + 48 * params.contention - alloc.mba) * 0.65 * wMba;
  const cpuDef = Math.max(0, 44 + 42 * params.burstLoad - alloc.cpu) * 0.9 * wCpu;
  const extra = Math.round(8 * params.contention * (0.4 + 0.6 * wLlc) + llcDef + mbaDef + cpuDef);
  return SVCS.map((svc, idx) => Math.round(svc.base * (0.85 + 0.35 * params.burstLoad) + (idx === victim ? extra : 0)));
}

function stepFirmSim(state: FirmState, params: FirmParams): FirmState {
  const timeSec = state.timeSec + 0.12;
  const ways = lerp(state.ways, params.closedLoop ? clamp(Math.round(4 + 7 * params.contention), 4, 11) : 3, 0.24);
  const mba = lerp(state.mba, params.closedLoop ? clamp(40 + 52 * params.contention, 35, 92) : 28, 0.24);
  const cpu = lerp(state.cpu, params.closedLoop ? clamp(45 + 42 * params.burstLoad, 40, 88) : 42, 0.24);
  const ms = calcFirmServiceMs({ ways, mba, cpu }, state.victim, params);
  const cp = RPC_PATHS[maxIndex(RPC_PATHS, (path) => sum(path.nodes, (idx) => ms[idx]))];
  const p99 = clamp(sum(cp.nodes, (idx) => ms[idx]) + 14 + 3.8 * Math.sin(timeSec * 2.1), 38, 168);
  return { victim: state.victim, timeSec, ways, mba, cpu, ms, cp, hist: pushRing(state.hist, p99, FIRM_CFG.nHist) };
}

function buildFirmIsoDom(mountEl: HTMLElement): FirmIsoDom {
  const bannerTitle = h('div', { cls: 'viz-card-title viz-ellipsis' });
  const bannerSub = h('div', { cls: 'viz-mono viz-ellipsis is-slate' });
  const banner = h('div', { cls: 'viz-card is-blue' }, bannerTitle, bannerSub);
  const waysVal = h('span', { cls: 'viz-mono' });
  const wayCells = range(FIRM_CFG.waysMax).map(() => h('span', { cls: 'way-cell' }));
  const waysNote = h('div', { cls: 'viz-note viz-ellipsis' });
  const mbaVal = h('span', { cls: 'viz-mono' });
  const mbaBar = h('progress', { cls: 'progress is-blue', max: 100, value: 78 });
  const cpuVal = h('span', { cls: 'viz-mono' });
  const cpuBar = h('progress', { cls: 'progress is-blue', max: 100, value: 70 });
  const foot = h('div', { cls: 'viz-mono viz-ellipsis has-text-centered' });
  mountEl.replaceChildren(
    banner,
    h('div', null, h('div', { cls: 'viz-row-hd' }, h('span', null, 'Last-Level Cache (CAT)'), waysVal), h('div', { cls: 'way-strip' }, ...wayCells), waysNote),
    h('div', null, h('div', { cls: 'viz-row-hd' }, h('span', null, 'Memory Bandwidth (MBA)'), mbaVal), mbaBar),
    h('div', null, h('div', { cls: 'viz-row-hd' }, h('span', null, 'CPU Quota Allocation'), cpuVal), cpuBar),
    foot,
  );
  return { banner, bannerTitle, bannerSub, waysVal, wayCells, waysNote, mbaVal, mbaBar, cpuVal, cpuBar, foot };
}

function updateFirmIsoDom(dom: FirmIsoDom, state: FirmState, closedLoop: boolean): void {
  const tone = closedLoop ? 'blue' : 'crimson';
  const svc = SVCS[state.victim];
  const waysInt = clamp(Math.round(state.ways), 1, 11);
  patchAttrs(dom.banner, { cls: `viz-card is-${tone}` });
  setText(dom.bannerTitle, closedLoop ? `FIRM Isolating: ${svc.name}` : `Static Shared: ${svc.name} Starved`);
  setText(dom.bannerSub, `Contended: ${svc.res}`);
  patchAttrs(dom.waysVal, { cls: `viz-mono is-${tone}` });
  setText(dom.waysVal, `${waysInt}/12 ways`);
  for (const [idx, cell] of dom.wayCells.entries()) {
    patchAttrs(cell, { cls: idx < waysInt ? `way-cell is-${tone}` : 'way-cell' });
  }
  setText(dom.waysNote, closedLoop ? 'Dedicated partition stops cache evictions' : 'Shared LLC suffers neighbor thrashing');
  for (const [valEl, barEl, pct] of [[dom.mbaVal, dom.mbaBar, Math.round(state.mba)], [dom.cpuVal, dom.cpuBar, Math.round(state.cpu)]] as const) {
    patchAttrs(valEl, { cls: `viz-mono is-${tone}` });
    setText(valEl, `${pct}%`);
    patchAttrs(barEl, { cls: `progress is-${tone}`, value: pct });
  }
  patchAttrs(dom.foot, { cls: `viz-mono viz-ellipsis has-text-centered is-${closedLoop ? 'teal' : 'crimson'}` });
  setText(dom.foot, closedLoop ? '← SLO slack feedback (closed loop) →' : '✕ Closed-loop feedback disabled');
}

function buildFirmTopoPatch(state: FirmState, cpStr: string): TopoPatch {
  return {
    footer: `Critical path: ${cpStr}`,
    nodes: toRecord(SVCS, (svc, idx) => [String(idx), {
      sub: `${state.ms[idx]}ms`,
      cls: idx === state.victim ? 'is-fault' : state.cp.nodes.includes(idx) ? 'is-warn' : 'is-slate',
      pressed: idx === state.victim,
      ariaLabel: `${svc.name} (${state.ms[idx]} ms) — inject contention`,
      tip: `**${svc.name}** (${state.ms[idx]} ms P99)\nClick to inject shared ${svc.res} contention here.`,
    }]),
    edges: toRecord(RPC_LINKS, ([src, dst]) => {
      const edgeId = `${src}-${dst}`;
      return [edgeId, { cls: state.cp.edges.includes(edgeId) ? 'is-crimson is-flowing' : 'is-muted' }];
    }),
  };
}

function readFirmParams(ctx: MountHandle): FirmParams {
  return { closedLoop: ctx.flag('closedLoop'), contention: ctx.num('contention'), burstLoad: ctx.num('burstLoad') };
}

function buildFirmP99Chart(svgNode: SVGSVGElement): (hist: readonly number[], p99Int: number, breached: boolean) => void {
  const chart = createChart(svgNode, { box: [226, 206], pad: [8, 8, 10, 8], x: [0, FIRM_CFG.nHist - 1], y: [30, 170] });
  chart.hband(100, 170, 'is-crimson');
  chart.hband(30, 100, 'is-teal');
  chart.hrule({ y: 100, cls: 'is-crimson is-dashed', label: 'SLO Target = 100 ms' });
  const p99Line = chart.line<number>((_, idx) => idx, (yVal) => yVal, 'is-blue');
  const sloBadge = chart.badge();
  return (hist, p99Int, breached) => {
    p99Line(hist, breached ? 'is-crimson' : 'is-blue');
    sloBadge(`${breached ? 'SLO BREACH' : 'SLO MET'} (${p99Int} ms)`, breached ? 'is-bad' : 'is-good');
  };
}

function initFirmTopo(svgNode: SVGSVGElement, onPickVictim: (victimIdx: number) => void): (patch: TopoPatch) => void {
  return renderTopo(svgNode, {
    box: [228, 206], footer: 'Critical path: FE → Srch → DB',
    nodes: SVCS.map((svc, idx) => ({ id: String(idx), kind: 'circle', x: svc.x, y: svc.y, r: 16.5, label: svc.id, sub: '18ms', click: true, cls: 'is-slate' })),
    edges: RPC_LINKS.map(([src, dst]) => ({ id: `${src}-${dst}`, d: rayEdge(SVCS[src], SVCS[dst], 18.5, 19.5), cls: 'is-muted' })),
    onNodeClick: (id) => {
      const victimIdx = Number(id);
      if (Number.isInteger(victimIdx) && victimIdx >= 0 && victimIdx < SVCS.length) {
        onPickVictim(victimIdx);
      }
    },
  });
}

function renderFirmView(
  ctx: MountHandle, state: FirmState,
  views: { readonly isoDom: FirmIsoDom; readonly patchTopo: (patch: TopoPatch) => void; readonly drawP99: (hist: readonly number[], p99Int: number, breached: boolean) => void },
): void {
  const closedLoop = ctx.flag('closedLoop');
  const svc = SVCS[state.victim];
  const cpStr = state.cp.nodes.map((idx) => SVCS[idx].id).join(' → ');
  const p99Int = Math.round(state.hist[state.hist.length - 1] ?? 66);
  const breached = p99Int > FIRM_CFG.sloMs;
  const waysInt = clamp(Math.round(state.ways), 1, 11);
  const cpuInt = Math.round(state.cpu);
  ctx.setMetric('bottleneck', state.cp.nodes.includes(state.victim) ? `${svc.name} on critical path (${state.ms[state.victim]} ms)` : `${svc.name} (${state.ms[state.victim]} ms · crit: ${cpStr})`, 'is-blue');
  ctx.setMetric('actuation', closedLoop ? `LLC ${waysInt}/12 · MemBW ${Math.round(state.mba)}% · CPU ${cpuInt}%` : `Static (${waysInt}/12 ways · CPU ${cpuInt}% · Contested)`);
  ctx.setMetric('p99', `${p99Int} ms ${breached ? '> 100 ms (SLO Breach!)' : '≤ 100 ms (SLO Met)'}`, breached ? 'is-crimson' : 'is-teal');
  updateFirmIsoDom(views.isoDom, state, closedLoop);
  views.patchTopo(buildFirmTopoPatch(state, cpStr));
  views.drawP99(state.hist, p99Int, breached);
}

mountFigure('ls-firm', FIRM_SPEC, (ctx) => {
  const seed: FirmState = { victim: 2, timeSec: 0, ways: 9, mba: 78, cpu: 70, ms: calcFirmServiceMs({ ways: 9, mba: 78, cpu: 70 }, 2, readFirmParams(ctx)), cp: RPC_PATHS[2], hist: [] };
  let simState = iterate(FIRM_CFG.nHist, seed, (s) => stepFirmSim(s, readFirmParams(ctx)));
  const isoDom = buildFirmIsoDom(ctx.el('firm-iso'));
  const drawP99 = buildFirmP99Chart(ctx.svg('svg-ls-firm-3'));
  const patchTopo = initFirmTopo(ctx.svg('svg-ls-firm-1'), (victimIdx) => {
    simState = iterate(ctx.isPlaying() ? 4 : 18, { ...simState, victim: victimIdx }, (s) => stepFirmSim(s, readFirmParams(ctx)));
    renderFirmView(ctx, simState, { isoDom, patchTopo, drawP99 });
  });
  return {
    step: () => {
      simState = stepFirmSim(simState, readFirmParams(ctx));
    },
    onCtrl: () => {
      simState = iterate(ctx.isPlaying() ? 4 : 18, simState, (s) => stepFirmSim(s, readFirmParams(ctx)));
    },
    render: () => {
      renderFirmView(ctx, simState, { isoDom, patchTopo, drawP99 });
    },
  };
});

// Figure 3: Disaggregated Storage Systems (Kaleidoscope)
type StNodeId = 'LNET1' | 'LNET2' | 'DS1' | 'DS2' | 'OSD1';
type StAllNodeId = 'C1' | 'C2' | StNodeId;
type StFaults = Readonly<Record<StNodeId, boolean>>;
type StEdgeState = 'active' | 'probe' | 'standby' | 'fault';

interface BetaRowSpec { readonly a: number; readonly b: number; readonly note: string; readonly amb: boolean }
interface BetaRowDom { readonly rowEl: HTMLDivElement; readonly stat: HTMLSpanElement; readonly areaPath: SVGPathElement; readonly linePath: SVGPathElement }
interface StDiagCtx {
  readonly lnetFault: boolean; readonly lnetUp: boolean; readonly haUp: boolean;
  readonly effProbes: boolean; readonly haMasked: boolean; readonly unmasked: boolean; readonly pings: number;
}

const ST_CLICK_IDS: readonly StNodeId[] = ['LNET1', 'LNET2', 'DS1', 'DS2', 'OSD1'];
const DEFAULT_ST_FAULTS: StFaults = { LNET1: false, LNET2: false, DS1: true, DS2: false, OSD1: false };
const ST_PRESETS = new Map<string, StFaults>([
  ['ha', DEFAULT_ST_FAULTS],
  ['lnet', { LNET1: true, LNET2: false, DS1: false, DS2: false, OSD1: false }],
  ['raid', { LNET1: false, LNET2: false, DS1: false, DS2: false, OSD1: true }],
  ['dual', { LNET1: false, LNET2: false, DS1: true, DS2: false, OSD1: true }],
]);
const ST_EDGE_PATCH: Record<StEdgeState, EdgePatch> = {
  fault: { cls: 'is-crimson is-dashed is-faint' }, standby: { cls: 'is-muted is-dashed' },
  probe: { cls: 'is-teal is-flowing' }, active: { cls: 'is-blue is-flowing' },
};
const ST_NODES = [
  { id: 'C1' as const, x: 36, y: 50, sub: 'Client C₁', click: false, tip: undefined },
  { id: 'C2' as const, x: 36, y: 142, sub: 'Client C₂', click: false, tip: undefined },
  { id: 'LNET1' as const, x: 114, y: 50, sub: 'LNET₁', click: true, tip: '**LNET₁ Router**\nClick to toggle fail-stop router drop.' },
  { id: 'LNET2' as const, x: 114, y: 142, sub: 'LNET₂', click: true, tip: '**LNET₂ Router**\nClick to toggle fail-stop router drop.' },
  { id: 'DS1' as const, x: 196, y: 50, sub: 'DS₁ (Primary)', click: true, tip: '**DS₁ (Primary Server)**\nClick to toggle silent HA fail-stop crash.' },
  { id: 'DS2' as const, x: 196, y: 142, sub: 'DS₂ (HA Peer)', click: true, tip: '**DS₂ (HA Peer Server)**\nClick to toggle silent HA fail-stop crash.' },
  { id: 'OSD1' as const, x: 274, y: 96, sub: 'OSD₁ (RAID)', click: true, tip: '**OSD₁ (RAID Array)**\nClick to toggle fail-slow RAID rebuild.' },
] as const;
const ST_NODE_BY_ID: Record<StAllNodeId, (typeof ST_NODES)[number]> = {
  C1: ST_NODES[0], C2: ST_NODES[1], LNET1: ST_NODES[2], LNET2: ST_NODES[3], DS1: ST_NODES[4], DS2: ST_NODES[5], OSD1: ST_NODES[6],
};
const ST_LINKS: ReadonlyArray<readonly [StAllNodeId, StAllNodeId]> = [
  ['C1', 'LNET1'], ['C2', 'LNET2'], ['C1', 'LNET2'], ['C2', 'LNET1'],
  ['LNET1', 'DS1'], ['LNET1', 'DS2'], ['LNET2', 'DS2'], ['LNET2', 'DS1'],
  ['DS1', 'OSD1'], ['DS2', 'OSD1'],
];
const ST_TOPO_EDGES: readonly TopoEdgeDef[] = [
  ...ST_LINKS.map(([src, dst]): TopoEdgeDef => ({ id: `${src}-${dst}`, d: rayEdge(ST_NODE_BY_ID[src], ST_NODE_BY_ID[dst], 19, 20), cls: 'is-blue is-flowing' })),
  { id: 'ha-12', d: 'M196,69 L196,122', cls: 'is-amber is-dashed', lx: 203, ly: 99, anchor: 'start', label: 'HA FAILOVER', show: false },
  { id: 'ha-21', d: 'M196,123 L196,70', cls: 'is-amber is-dashed', lx: 203, ly: 99, anchor: 'start', label: 'HA FAILOVER', show: false },
];
const ST_ROW_NAMES: readonly string[] = ['DS₁ (Primary)', 'DS₂ (HA Peer)', 'LNET Fabric', 'OSD₁ (RAID)'];
const U_GRID: readonly number[] = range(49).map((idx) => idx / 48);
const BETA_AREA_GEN = d3Area<readonly [number, number]>().x((pt) => pt[0]).y0(23).y1((pt) => pt[1]).curve(monotoneX);
const BETA_LINE_GEN = d3Line<readonly [number, number]>().x((pt) => pt[0]).y((pt) => pt[1]).curve(monotoneX);

const ST_SPEC: FigureSpec = {
  kicker: 'Figure 3 · Disaggregated Storage Systems (Kaleidoscope) · Active Route-Pinned Probing and HA Storage Tomography',
  presets: { label: 'Fault Scenarios', items: [{ id: 'ha', label: 'Silent HA Crash', active: true }, { id: 'lnet', label: 'LNET Drop' }, { id: 'raid', label: 'RAID Rebuild' }, { id: 'dual', label: 'Dual Fault' }] },
  toggles: [{ key: 'probes', label: 'Pinned Probes', on: true }],
  actions: ['play'],
  legend: [
    { kind: 'swatch', tone: 'blue', label: 'Passive client I/O' },
    { kind: 'swatch', tone: 'teal', label: 'Route-pinned active probe' },
    { kind: 'swatch', tone: 'amber', label: 'Active-active HA failover' },
    { kind: 'swatch', tone: 'crimson', label: 'Injected fault (click node)' },
  ],
  grid: 'is-2col',
  panels: [
    { kind: 'plot', title: 'DISAGGREGATED STORAGE TOPOLOGY (CLICK TO FAULT)', svgId: 'svg-ls-storage-a' },
    { kind: 'plot', cls: 'is-stack', subpanels: [{ title: 'STAGE 1 · FACTOR-GRAPH HEALTH POSTERIORS (N = 25 PINGS)', titleKey: 'st-p-title', mountId: 'st-posteriors', mountCls: 'beta-list' }, { title: 'STAGE 2 · PEER LOG & LATENCY FORENSICS', mountId: 'st-forensic', mountCls: 'viz-card' }] },
  ],
  sliders: [
    { key: 'pings', label: 'Active I/O probe batch N', min: 5, max: 35, step: 2, value: 25, fmt: (v) => `${Math.round(v)} pings` },
    { key: 'congest', label: 'Background RAID / I/O congestion', min: 0.1, max: 0.95, step: 0.05, value: 0.35, fmt: (v) => v.toFixed(2) },
  ],
  metrics: [{ key: 'clientIo', label: 'Client I/O' }, { key: 'activeProbes', label: 'Active probes' }, { key: 'verdict', label: 'Forensic verdict' }],
};

function isStNodeId(id: string): id is StNodeId {
  return ST_CLICK_IDS.some((candidate) => candidate === id);
}

function matchStPreset(faults: StFaults): string | null {
  for (const [presetId, presetFaults] of ST_PRESETS) {
    if (ST_CLICK_IDS.every((key) => presetFaults[key] === faults[key])) {
      return presetId;
    }
  }
  return null;
}

const calcBetaPaths = memoBy((alpha: number, beta: number): { readonly areaD: string; readonly lineD: string } => {
  const mode = clamp(alpha > 1 && beta > 1 ? (alpha - 1) / (alpha + beta - 2) : alpha >= beta ? 0.96 : 0.04, 0.005, 0.995);
  const pts: Array<readonly [number, number]> = U_GRID.map((uVal) => {
    const x = clamp(uVal, 0.005, 0.995);
    const pdf = Math.exp(clamp((alpha - 1) * Math.log(x / mode) + (beta - 1) * Math.log((1 - x) / (1 - mode)), -20, 0));
    return [uVal * 260, 23 - pdf * 20];
  });
  return { areaD: BETA_AREA_GEN(pts) ?? '', lineD: BETA_LINE_GEN(pts) ?? '' };
}, 16);

function dsPosterior(hit: boolean, peer: boolean, dctx: StDiagCtx): BetaRowSpec {
  return matchRule<BetaRowSpec>([
    [!dctx.lnetUp, { a: 2.0, b: 2.0, note: 'Unreachable (LNET Outage)', amb: true }],
    [!dctx.effProbes && hit && peer, { a: 1.2, b: 2 + dctx.pings * 0.45, note: 'Dual HA Outage', amb: false }],
    [!dctx.effProbes && hit !== peer, { a: 2.4, b: 2.0, note: 'HA-Masked (Ambiguous!)', amb: true }],
    [!dctx.effProbes, { a: 2 + dctx.pings * 0.4, b: 1.3, note: 'Healthy', amb: false }],
    [hit, { a: 1.2, b: 2 + dctx.pings * 0.55, note: 'Isolated by Pinned Probes!', amb: false }],
  ], { a: 2 + dctx.pings * 0.55, b: 1.3, note: peer ? 'Healthy (Serving HA)' : 'Healthy', amb: false });
}

function computeStorageRows(faults: StFaults, dctx: StDiagCtx): readonly BetaRowSpec[] {
  const lnetRow = matchRule<BetaRowSpec>([
    [!dctx.lnetUp, { a: 1.2, b: 2 + dctx.pings * 0.5, note: 'Dual LNET Outage', amb: false }],
    [!dctx.lnetFault, { a: 2 + dctx.pings * 0.5, b: 1.3, note: 'Healthy', amb: false }],
    [!dctx.effProbes, { a: 2.3, b: 2.0, note: 'Multipath-Masked (Ambiguous!)', amb: true }],
  ], { a: 1.3, b: 2 + dctx.pings * 0.5, note: 'Isolated by Pinned Probes!', amb: false });
  const osdRow = matchRule<BetaRowSpec>([
    [!dctx.lnetUp, { a: 2.0, b: 2.0, note: 'Unreachable (LNET Outage)', amb: true }],
    [!dctx.haUp, { a: 2.0, b: 2.0, note: 'Unreachable (Dual HA Outage)', amb: true }],
    [faults.OSD1, { a: 2 + dctx.pings * 0.14, b: 2 + dctx.pings * 0.28, note: 'Degraded Timeout', amb: false }],
  ], { a: 2 + dctx.pings * 0.5, b: 1.3, note: 'Healthy', amb: false });
  return [dsPosterior(faults.DS1, faults.DS2, dctx), dsPosterior(faults.DS2, faults.DS1, dctx), lnetRow, osdRow];
}

function buildBetaRowsDom(mountEl: HTMLElement): BetaRowDom[] {
  const rows = ST_ROW_NAMES.map((name): BetaRowDom => {
    const stat = h('span', { cls: 'viz-mono viz-ellipsis' });
    const areaPath = svgEl('path');
    const linePath = svgEl('path');
    const svg = svgEl('svg', { viewBox: '0 0 260 24', preserveAspectRatio: 'none', 'aria-hidden': 'true', cls: 'beta-svg' }, svgEl('line', { x1: 0, x2: 260, y1: 23, y2: 23, cls: 'viz-rule is-muted' }), areaPath, linePath);
    return { rowEl: h('div', { cls: 'beta-row' }, h('div', { cls: 'viz-row-hd' }, h('strong', null, name), stat), svg), stat, areaPath, linePath };
  });
  mountEl.replaceChildren(...rows.map((row) => row.rowEl));
  return rows;
}

function updateBetaRowsDom(betaRows: readonly BetaRowDom[], specs: readonly BetaRowSpec[]): void {
  for (const [idx, spec] of specs.entries()) {
    const row = betaRows[idx];
    const meanHealth = spec.a / (spec.a + spec.b);
    const tone = spec.amb ? 'amber' : meanHealth < 0.48 ? 'crimson' : 'teal';
    const { areaD, lineD } = calcBetaPaths(spec.a, spec.b);
    patchAttrs(row.stat, { cls: `viz-mono viz-ellipsis is-${tone}` });
    setText(row.stat, `E[X]=${meanHealth.toFixed(2)} · ${spec.note}`);
    patchAttrs(row.areaPath, { cls: `viz-area is-${tone}`, d: areaD });
    patchAttrs(row.linePath, { cls: `viz-line is-${tone}`, d: lineD });
  }
}

function buildStorageTopoPatch(faults: StFaults, dctx: StDiagCtx): TopoPatch {
  return {
    nodes: toRecord(ST_CLICK_IDS, (id) => {
      const isFaulted = faults[id];
      const spec = ST_NODE_BY_ID[id];
      return [id, { sub: isFaulted ? (id === 'OSD1' ? 'Rebuild Slow' : 'Faulted') : spec.sub, cls: isFaulted ? 'is-fault' : 'is-blue-ring', pressed: isFaulted, ariaLabel: `${spec.sub} (${isFaulted ? 'faulted' : 'healthy'}) — toggle fault` }];
    }),
    edges: {
      'C1-LNET1': ST_EDGE_PATCH[faults.LNET1 ? 'fault' : 'active'],
      'C2-LNET2': ST_EDGE_PATCH[faults.LNET2 ? 'fault' : 'active'],
      'C1-LNET2': ST_EDGE_PATCH[faults.LNET2 ? 'fault' : faults.LNET1 ? 'active' : 'standby'],
      'C2-LNET1': ST_EDGE_PATCH[faults.LNET1 ? 'fault' : faults.LNET2 ? 'active' : 'standby'],
      'LNET1-DS1': ST_EDGE_PATCH[faults.LNET1 || faults.DS1 ? 'fault' : dctx.effProbes ? 'probe' : 'active'],
      'LNET2-DS2': ST_EDGE_PATCH[faults.LNET2 || faults.DS2 ? 'fault' : dctx.effProbes ? 'probe' : 'active'],
      'LNET1-DS2': ST_EDGE_PATCH[faults.LNET1 || faults.DS2 ? 'fault' : dctx.effProbes ? 'probe' : faults.DS1 ? 'active' : 'standby'],
      'LNET2-DS1': ST_EDGE_PATCH[faults.LNET2 || faults.DS1 ? 'fault' : dctx.effProbes ? 'probe' : faults.DS2 ? 'active' : 'standby'],
      'DS1-OSD1': ST_EDGE_PATCH[faults.DS1 || faults.OSD1 ? 'fault' : !dctx.lnetUp ? 'standby' : dctx.effProbes ? 'probe' : 'active'],
      'DS2-OSD1': ST_EDGE_PATCH[faults.DS2 || faults.OSD1 ? 'fault' : !dctx.lnetUp ? 'standby' : dctx.effProbes ? 'probe' : 'active'],
      'ha-12': { show: dctx.haMasked && faults.DS1 },
      'ha-21': { show: dctx.haMasked && faults.DS2 },
    },
  };
}

function computeStorageVerdict(faults: StFaults, congest: number, dctx: StDiagCtx): { readonly verdict: string; readonly hwFault: boolean; readonly passIo: boolean; readonly outage: boolean; readonly logText: string } {
  const hwFault = faults.DS1 || faults.DS2 || dctx.lnetFault;
  const slow = faults.OSD1 || congest > 0.55;
  const passIo = dctx.lnetUp && dctx.haUp && !faults.OSD1;
  const outage = !dctx.lnetUp || !dctx.haUp;
  const verdict = matchRule([
    [!dctx.lnetUp, 'Dual LNET Fabric Outage'],
    [!dctx.haUp, 'Dual HA Server Outage'],
    [!dctx.unmasked, dctx.haMasked ? 'HA Masked (Turn Probes ON)' : 'Multipath Masked (Turn Probes ON)'],
    [hwFault && slow, 'HW Fault + Slow I/O Separated'],
    [hwFault, 'Fail-Stop HW Fault Isolated'],
    [slow, 'I/O Congestion (No HW Fault)'],
  ], 'All Targets Nominal');
  const tokens = [...(faults.DS1 || faults.DS2 ? ['Lustre_Evict', 'HB_Timeout'] : []), ...(dctx.lnetFault ? ['IB_PortDown'] : [])];
  const lofDisp = (1.05 + (faults.OSD1 ? 1.25 : 0) + congest * 0.95).toFixed(2);
  const logText = outage
    ? `Peer log diff: Target OSD unreachable (${!dctx.lnetUp ? 'fabric' : 'dual HA'} outage)`
    : !dctx.unmasked
    ? `Peer log diff: Undetermined (${dctx.haMasked ? 'HA' : 'multipath'} target unisolated)`
    : `Peer log diff = ${tokens.length ? `{${tokens.join(', ')}}` : '∅'}  |  Peer LOF = ${lofDisp}×`;
  return { verdict, hwFault, passIo, outage, logText };
}

function renderStorageView(
  ctx: MountHandle, faults: StFaults,
  dom: { readonly betaRows: readonly BetaRowDom[]; readonly logEl: HTMLDivElement; readonly verdictEl: HTMLDivElement; readonly patchTopo: (patch: TopoPatch) => void },
): void {
  const pings = Math.round(ctx.num('pings'));
  const probesOn = ctx.flag('probes');
  const lnetFault = faults.LNET1 || faults.LNET2;
  const lnetUp = !(faults.LNET1 && faults.LNET2);
  const haUp = !(faults.DS1 && faults.DS2);
  const effProbes = probesOn && lnetUp;
  const haMasked = faults.DS1 !== faults.DS2 && lnetUp;
  const unmasked = !((haMasked || (lnetFault && lnetUp && haUp)) && !effProbes);
  const dctx: StDiagCtx = { lnetFault, lnetUp, haUp, effProbes, haMasked, unmasked, pings };
  const diag = computeStorageVerdict(faults, ctx.num('congest'), dctx);

  ctx.setTitle('st-p-title', `STAGE 1 · FACTOR-GRAPH HEALTH POSTERIORS (N = ${pings} PINGS)`);
  ctx.setMetric('clientIo', !diag.passIo ? 'Passive I/O: FAIL' : haMasked ? 'Passive I/O: PASS (HA Masked)' : lnetFault ? 'Passive I/O: PASS (LNET Multipath)' : 'Passive I/O: PASS (Nominal)', !diag.passIo ? 'is-crimson' : haMasked || lnetFault ? 'is-blue' : 'is-teal');
  ctx.setMetric('activeProbes', !probesOn ? 'Passive I/O Only' : !lnetUp ? 'Probes Blocked (LNET Down)' : `Pinned Probes (${pings} pings)`);
  ctx.setMetric('verdict', diag.verdict, !unmasked || diag.outage ? 'is-crimson' : 'is-teal');
  updateBetaRowsDom(dom.betaRows, computeStorageRows(faults, dctx));
  patchAttrs(dom.logEl, { cls: `viz-mono viz-ellipsis${diag.hwFault && effProbes ? ' is-crimson' : ''}` });
  setText(dom.logEl, diag.logText);
  patchAttrs(dom.verdictEl, { cls: `viz-card-title viz-ellipsis is-${!unmasked || diag.outage ? 'crimson' : diag.hwFault ? 'blue' : 'teal'}` });
  setText(dom.verdictEl, unmasked && !diag.outage ? `Verdict: ${diag.verdict}` : diag.verdict);
  dom.patchTopo(buildStorageTopoPatch(faults, dctx));
}

mountFigure('ls-storage', ST_SPEC, (ctx) => {
  let faults: StFaults = DEFAULT_ST_FAULTS;
  const betaRows = buildBetaRowsDom(ctx.el('st-posteriors'));
  const logEl = h('div', { cls: 'viz-mono viz-ellipsis' });
  const verdictEl = h('div', { cls: 'viz-card-title viz-ellipsis' });
  ctx.el('st-forensic').replaceChildren(logEl, verdictEl);
  const patchTopo = renderTopo(ctx.svg('svg-ls-storage-a'), {
    box: [312, 192],
    nodes: ST_NODES.map((n) => ({ id: n.id, kind: 'circle', x: n.x, y: n.y, r: 17, label: n.id, sub: n.sub, click: n.click, cls: n.click ? 'is-blue-ring' : 'is-slate', tip: n.tip })),
    edges: ST_TOPO_EDGES,
    onNodeClick: (id) => {
      if (isStNodeId(id)) {
        faults = { ...faults, [id]: !faults[id] };
        ctx.setPreset(matchStPreset(faults));
        renderStorageView(ctx, faults, { betaRows, logEl, verdictEl, patchTopo });
      }
    },
  });
  return {
    onPreset: (id) => {
      faults = ST_PRESETS.get(id) ?? faults;
    },
    render: () => {
      renderStorageView(ctx, faults, { betaRows, logEl, verdictEl, patchTopo });
    },
  };
});

// Figure 4: Uncertainty-Aware Telemetry (BayesPerf)
interface ObsPt { readonly truth: number; readonly perf: number; readonly ep: number; readonly ci: number }
interface ObsEval {
  readonly sets: ReadonlyArray<readonly number[]>; readonly series: readonly ObsPt[];
  readonly blueEpochs: number; readonly bluePct: number; readonly errEp: number; readonly errPerf: number;
}

const OBS_CFG = { nEp: 12, nPts: 84 } as const;
const PMU_VARS = [
  { short: 'Ret', name: 'Retiring', x: 42, y: 40, side: 'bottom' },
  { short: 'FE', name: 'FE Bound', x: 42, y: 102, side: 'bottom' },
  { short: 'Spec', name: 'Bad Spec', x: 42, y: 164, side: 'bottom' },
  { short: 'L2', name: 'L2 Stall', x: 166, y: 46, side: 'right' },
  { short: 'L3', name: 'L3 Stall', x: 166, y: 108, side: 'right' },
  { short: 'DRAM', name: 'DRAM Stall', x: 166, y: 170, side: 'right' },
] as const;
const PMU_FACTORS = [{ label: 'ψ_Σ', y: 68, vars: [0, 1, 2, 3] }, { label: 'ψ_L2', y: 120, vars: [2, 3, 4] }, { label: 'ψ_BW', y: 168, vars: [4, 5] }] as const;
const OBS_TOPO_NODES: readonly TopoNodeDef[] = [
  ...PMU_FACTORS.map((f, fi): TopoNodeDef => ({ id: `f-${fi}`, kind: 'pill', x: 106, y: f.y, w: 34, h: 22, label: f.label, cls: 'is-teal-pill' })),
  ...PMU_VARS.map((pmu, vi): TopoNodeDef => ({
    id: `v-${vi}`, kind: 'circle', x: pmu.x, y: pmu.y, r: 15.5, label: pmu.short, sub: pmu.name, subSide: pmu.side, click: true, cls: 'is-slate',
    tip: `**${pmu.name} (${pmu.short})**\nClick to inspect this counter's 12-epoch reconstruction.`,
  })),
];
const OBS_TOPO_EDGES: readonly TopoEdgeDef[] = PMU_FACTORS.flatMap((f, fi) =>
  f.vars.map((vi): TopoEdgeDef => ({ id: `e-${fi}-${vi}`, d: `M106,${f.y}L${PMU_VARS[vi].x},${PMU_VARS[vi].y}`, arrow: false, cls: 'is-muted' })),
);

const OBS_SPEC: FigureSpec = {
  kicker: 'Figure 4 · Uncertainty-Aware Telemetry (BayesPerf) · Architectural Conservation Laws Across Physical PMU Budgets',
  toggles: [{ key: 'overlap', label: 'Window Overlap', on: true }],
  actions: ['step', 'play'], stepLabel: 'Step Epoch', stepMs: 1500,
  legend: [
    { kind: 'swatch', tone: 'blue', label: 'Physically monitored PMU' },
    { kind: 'band', tone: 'orange', label: 'Current epoch' },
    { kind: 'swatch', tone: 'amber', label: 'Overlapping window variable' },
    { kind: 'swatch', tone: 'teal', label: 'Conservation factor' },
    { kind: 'line', tone: 'navy', label: 'True counter rate' },
    { kind: 'line', tone: 'blue', label: 'BayesPerf posterior' },
    { kind: 'band', tone: 'teal', label: 'BayesPerf ±95% CI' },
    { kind: 'line', tone: 'crimson', dashed: true, label: 'Linear time-scaled `perf`' },
  ],
  grid: 'is-2col-asym',
  panels: [
    { kind: 'plot', title: 'FACTOR GRAPH (2/6 PMUs · CLICK NODE)', titleKey: 'obs-g-title', svgId: 'svg-ls-obs-a' },
    { kind: 'plot', title: 'RECONSTRUCTION OF L3 STALL (4/12 EPOCHS = 33% BLUE)', titleKey: 'obs-c-title', svgId: 'svg-ls-obs-b' },
  ],
  sliders: [
    { key: 'pmus', label: 'Physical PMU registers per epoch', min: 1, max: 6, step: 1, value: 2, fmt: (v) => {
      const k = Math.round(v);
      return k === 6 ? 'All 6 PMUs' : k === 1 ? '1 PMU (Single)' : `${k} / 6 PMUs`;
    } },
    { key: 'burst', label: 'Workload phase burstiness', min: 0.25, max: 1.0, step: 0.05, value: 0.7, fmt: (v) => v.toFixed(2) },
  ],
  metrics: [{ key: 'coverage', label: 'Monitored coverage' }, { key: 'overlap', label: 'Window overlap' }, { key: 'bayesErr', label: 'BayesPerf error' }, { key: 'perfErr', label: 'Linear perf error' }],
};

function buildObsSeries(sets: ReadonlyArray<readonly number[]>, kPmus: number, burst: number, inspected: number): ObsPt[] {
  const nbrs = [...new Set(PMU_FACTORS.filter((f) => f.vars.some((v) => v === inspected)).flatMap((f) => f.vars).filter((vi) => vi !== inspected))];
  const shift = inspected * 0.85;
  let last = 0.46;
  return range(OBS_CFG.nPts).map((ptIdx) => {
    const u = ptIdx / (OBS_CFG.nPts - 1);
    const epoch = Math.min(OBS_CFG.nEp - 1, Math.floor(u * OBS_CFG.nEp));
    const curSet = sets[epoch];
    const prevSet = sets[(epoch + OBS_CFG.nEp - 1) % OBS_CFG.nEp];
    const sched = curSet.includes(inspected);
    const actNbrs = nbrs.filter((nb) => curSet.includes(nb)).length;
    const ovFrac = kPmus > 1 ? Math.min(1, curSet.filter((vi) => prevSet.includes(vi)).length / Math.max(1, kPmus - 1)) : 0;
    const truth = clamp(0.47 + 0.26 * burst * Math.sin(u * Math.PI * 5 + shift) + 0.13 * burst * Math.cos(u * Math.PI * 11 + shift), 0.09, 0.91);
    last = sched ? truth : last;
    const gain = clamp(0.12 + 0.54 * (actNbrs / Math.max(1, nbrs.length)) + 0.34 * ovFrac, 0.1, 0.94);
    return {
      truth, perf: sched ? truth : clamp(last * (1 + 0.13 * Math.sin(epoch * 2.1)), 0.06, 0.95),
      ep: sched ? truth : lerp(last, truth, gain), ci: sched ? 0.022 : clamp(0.24 - 0.18 * gain, 0.045, 0.23),
    };
  });
}

const calcObsModel = memoBy((kPmus: number, overlap: boolean, burst: number, inspected: number): ObsEval => {
  const sets = range(OBS_CFG.nEp).map((ep) => kPmus >= 6 ? [0, 1, 2, 3, 4, 5] : range(kPmus).map((slot) => ((overlap && kPmus >= 2 ? ep + slot : ep * kPmus + slot) % 6)));
  const series = buildObsSeries(sets, kPmus, burst, inspected);
  const blueEpochs = sets.filter((s) => s.includes(inspected)).length;
  return { sets, series, blueEpochs, bluePct: Math.round((blueEpochs / OBS_CFG.nEp) * 100), errEp: mean(series, (d) => Math.abs(d.ep - d.truth)), errPerf: mean(series, (d) => Math.abs(d.perf - d.truth)) };
}, 16);

function buildObsTopoPatch(kPmus: number, inspected: number, curSet: readonly number[], overlapVars: readonly number[]): TopoPatch {
  return {
    nodes: toRecord(range(6), (vi) => {
      const monitored = curSet.includes(vi);
      const isOv = kPmus > 1 && kPmus < 6 && overlapVars.includes(vi);
      return [`v-${vi}`, { cls: monitored ? 'is-blue-solid' : 'is-slate', ring: vi === inspected ? 'dashed' : isOv ? 'solid' : '', pressed: vi === inspected, ariaLabel: `Inspect ${PMU_VARS[vi].name} (${monitored ? 'monitored' : 'latent'})` }];
    }),
    edges: Object.fromEntries(
      PMU_FACTORS.flatMap((factor, fi) => {
        const hasMeas = factor.vars.some((vi) => curSet.includes(vi));
        return factor.vars.map((vi) => [`e-${fi}-${vi}`, { cls: hasMeas && !curSet.includes(vi) ? 'is-teal is-flowing' : hasMeas ? 'is-blue-soft' : 'is-muted' }] as const);
      }),
    ),
  };
}

function buildObsReconLayers(svgNode: SVGSVGElement): (obs: ObsEval, curEp: number, inspected: number, kPmus: number) => void {
  const chart = createChart(svgNode, { box: [380, 212], pad: [8, 8, 10, 8], x: [0, OBS_CFG.nPts - 1], y: [0, 1] });
  const epW = (OBS_CFG.nPts - 1) / OBS_CFG.nEp;
  const epCols = chart.cols<readonly number[]>(epW, (_, epochIdx) => epochIdx * epW);
  const activeEp = chart.vband({ cls: 'is-active-ep' });
  const activeFrame = svgEl('rect', { cls: 'viz-active-ep-frame', y: chart.y0 + 0.7, height: chart.h - 1.4 });
  chart.overlayEl.append(activeFrame);
  const ciArea = chart.area<ObsPt>((_, idx) => idx, (d) => d.ep - d.ci, (d) => d.ep + d.ci, 'is-teal');
  const truthLine = chart.line<ObsPt>((_, idx) => idx, (d) => d.truth, 'is-navy');
  const perfLine = chart.line<ObsPt>((_, idx) => idx, (d) => d.perf, 'is-crimson is-dashed');
  const epLine = chart.line<ObsPt>((_, idx) => idx, (d) => d.ep, 'is-blue');

  return (obs, curEp, inspected, kPmus) => {
    const xA = curEp * epW;
    const xB = (curEp + 1) * epW;
    epCols(obs.sets, (epochSet, epochIdx) => (epochIdx === curEp ? 'is-empty' : epochSet.includes(inspected) ? 'is-blue' : 'is-grid'));
    activeEp(xA, xB);
    patchAttrs(activeFrame, { x: chart.sx(xA) + 0.7, width: Math.max(0, chart.sx(xB) - chart.sx(xA) - 1.4) });
    ciArea(obs.series);
    truthLine(obs.series);
    perfLine(obs.series, 'is-crimson is-dashed', kPmus < 6);
    epLine(obs.series);
  };
}

function renderObsView(
  ctx: MountHandle, state: { readonly epochCursor: number; readonly inspected: number },
  patchTopo: (patch: TopoPatch) => void, drawRecon: (obs: ObsEval, curEp: number, inspected: number, kPmus: number) => void,
): void {
  const kPmus = Math.round(ctx.num('pmus'));
  const obs = calcObsModel(kPmus, ctx.flag('overlap'), ctx.num('burst'), state.inspected);
  const curEp = state.epochCursor % OBS_CFG.nEp;
  const curSet = obs.sets[curEp];
  const prevSet = obs.sets[(curEp + OBS_CFG.nEp - 1) % OBS_CFG.nEp];
  const overlapVars = kPmus >= 6 ? curSet : curSet.filter((vi) => prevSet.includes(vi));
  const shared = kPmus > 1 ? overlapVars.length : 0;
  ctx.setTitle('obs-g-title', `FACTOR GRAPH (${kPmus}/6 PMUs · CLICK NODE)`);
  ctx.setTitle('obs-c-title', `RECONSTRUCTION OF ${PMU_VARS[state.inspected].name.toUpperCase()} (${obs.blueEpochs}/${OBS_CFG.nEp} EPOCHS = ${obs.bluePct}% BLUE)`);
  ctx.setMetric('coverage', kPmus === 6 ? '6 / 6 PMUs (100% direct)' : `${kPmus} / 6 PMUs (${obs.bluePct}% blue)`, 'is-blue');
  ctx.setMetric('overlap', kPmus === 6 ? 'Full direct observation' : `${shared} shared counter${shared === 1 ? '' : 's'}`);
  ctx.setMetric('bayesErr', kPmus === 6 ? '0.000' : obs.errEp.toFixed(3), 'is-teal');
  ctx.setMetric('perfErr', kPmus === 6 ? '0.000 (no mux)' : obs.errPerf.toFixed(3), kPmus === 6 ? 'is-teal' : 'is-crimson');
  patchTopo(buildObsTopoPatch(kPmus, state.inspected, curSet, overlapVars));
  drawRecon(obs, curEp, state.inspected, kPmus);
}

mountFigure('ls-obs', OBS_SPEC, (ctx) => {
  let state = { epochCursor: 0, inspected: 4 };
  const drawRecon = buildObsReconLayers(ctx.svg('svg-ls-obs-b'));
  const patchTopo = renderTopo(ctx.svg('svg-ls-obs-a'), {
    box: [246, 212], nodes: OBS_TOPO_NODES, edges: OBS_TOPO_EDGES,
    onNodeClick: (id) => {
      const nextIdx = id.startsWith('v-') ? Number(id.slice(2)) : NaN;
      if (Number.isInteger(nextIdx) && nextIdx >= 0 && nextIdx < PMU_VARS.length) {
        state = { ...state, inspected: nextIdx };
        renderObsView(ctx, state, patchTopo, drawRecon);
      }
    },
  });
  return {
    step: () => {
      state = { ...state, epochCursor: state.epochCursor + 1 };
    },
    render: () => {
      renderObsView(ctx, state, patchTopo, drawRecon);
    },
  };
});
