/**
 * @fileoverview Interactive figures for the Intelligence-Augmented Computer
 * Systems project page (`learnedsystems`).
 */

import { clamp, createRng, h, iterate, lerp, maxIndex, mountFigure, patchAttrs, pushRing, range, setText, sum, toRecord, type FigureSpec, type MountHandle, type Rng } from '../lib/engine';
import { createChart, rayEdge, renderTopo, type TopoConfig, type TopoPatch } from '../lib/layers';

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
