/**
 * @fileoverview Interactive figures for the Intelligence-Augmented Computer
 * Systems project page (`learnedsystems`).
 */

import { clamp, createRng, iterate, lerp, mountFigure, pushRing, sum, type FigureSpec, type MountHandle, type Rng } from '../lib/engine';
import { createChart, renderTopo, type TopoConfig } from '../lib/layers';

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
