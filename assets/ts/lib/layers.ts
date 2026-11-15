/**
 * @fileoverview Pointer-capture SVG drag handler, status badges, decoupled
 * Cartesian chart layout/layers, and accessible SVG topology renderer.
 */

import select, { type Sel } from 'd3-selection/select';
import d3Area from 'd3-shape/area';
import d3Line from 'd3-shape/line';
import { monotoneX } from 'd3-shape/monotone';
import { assertNever, clamp, linearScale, patchAttrs, setShow, setText, svgEl, type AttrMap, type LinearScale } from './engine';

const CHART_CFG = {
  pad: [8, 8, 10, 8] as const, badgeH: 19, badgeRx: 4, badgeTextY: 13,
  badgeMinW: 96, badgeMaxW: 280, badgeCharW: 6.3, badgePadW: 16,
  badgeInset: 7, vbandMinLabelW: 34, axisTitleX: 11, singularDetEps: 1e-8,
} as const;

const TOPO_CFG = {
  cardW: 100, cardH: 42, cardRx: 7, pillW: 66, pillH: 22, pillRx: 6,
  circleR: 16.5, ringPad: 4, hdrH: 17, hdrRx: 4,
} as const;

interface DragSession { activeId: number | null; ctmInv: DOMMatrix | null; rafId: number | null; lastX: number; lastY: number }

function bindDragEnd(svgNode: SVGSVGElement, session: DragSession): (event: PointerEvent) => void {
  function end(event: PointerEvent): void {
    if (session.activeId !== event.pointerId) {
      return;
    }
    session.activeId = null;
    session.ctmInv = null;
    if (session.rafId !== null) {
      cancelAnimationFrame(session.rafId);
      session.rafId = null;
    }
  }
  for (const evt of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    svgNode.addEventListener(evt, end);
  }
  return end;
}

function startDragSession(svgNode: SVGSVGElement, session: DragSession, event: PointerEvent, flush: () => void): void {
  const ctm = event.button === 0 && session.activeId === null ? svgNode.getScreenCTM() : null;
  if (!ctm || Math.abs(ctm.a * ctm.d - ctm.b * ctm.c) < CHART_CFG.singularDetEps) {
    return;
  }
  session.activeId = event.pointerId;
  session.ctmInv = ctm.inverse();
  try {
    svgNode.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events may throw InvalidStateError on setPointerCapture.
  }
  session.lastX = event.clientX;
  session.lastY = event.clientY;
  flush();
}

/** Binds rAF-coalesced, CTM-inverted pointer-capture dragging to `svgNode`. */
export function bindDrag(svgNode: SVGSVGElement, onMove: (px: number, py: number) => void): void {
  svgNode.classList.add('is-draggable');
  const session: DragSession = { activeId: null, ctmInv: null, rafId: null, lastX: 0, lastY: 0 };
  const end = bindDragEnd(svgNode, session);
  function flush(): void {
    session.rafId = null;
    if (session.ctmInv) {
      const pt = new DOMPoint(session.lastX, session.lastY).matrixTransform(session.ctmInv);
      onMove(pt.x, pt.y);
    }
  }
  svgNode.addEventListener('pointerdown', (event: PointerEvent) => {
    startDragSession(svgNode, session, event, flush);
  });
  svgNode.addEventListener('pointermove', (event: PointerEvent) => {
    if (session.activeId !== event.pointerId) {
      return;
    }
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      end(event);
      return;
    }
    session.lastX = event.clientX;
    session.lastY = event.clientY;
    session.rafId ??= requestAnimationFrame(flush);
  });
}

/** Appends a `context-stroke` arrowhead `<marker>` to `defs` and returns `id`. */
export function addArrowMarker(defs: SVGDefsElement, id: string): string {
  defs.append(svgEl('marker', { id, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' }, svgEl('path', { d: 'M 0 1.5 L 10 5 L 0 8.5 L 2.2 5 z', fill: 'context-stroke' })));
  return id;
}

interface BadgePos { readonly x?: number | ((badgeWidth: number) => number); readonly y?: number; readonly minW?: number; readonly maxW?: number }

/** Idempotent updater for an SVG status pill badge created by `mountBadge`. */
export type BadgeUpdater = (text: string, cls: string, pos?: BadgePos) => void;

/** Mounts a repositionable status pill badge inside `parent`. */
export function mountBadge(parent: SVGGElement, initX = 0, initY = 0): BadgeUpdater {
  const rect = svgEl('rect', { rx: CHART_CFG.badgeRx, height: CHART_CFG.badgeH });
  const lbl = svgEl('text', { y: CHART_CFG.badgeTextY, 'text-anchor': 'middle' });
  const grp = svgEl('g', null, rect, lbl);
  parent.append(grp);
  return (text, cls, pos) => {
    const width = clamp(text.length * CHART_CFG.badgeCharW + CHART_CFG.badgePadW, pos?.minW ?? CHART_CFG.badgeMinW, pos?.maxW ?? CHART_CFG.badgeMaxW);
    const nextX = pos?.x ?? initX;
    const px = typeof nextX === 'function' ? nextX(width) : nextX;
    patchAttrs(grp, { cls: `viz-badge ${cls}`, transform: `translate(${px},${pos?.y ?? initY})` });
    patchAttrs(rect, { width });
    patchAttrs(lbl, { x: width * 0.5 });
    setText(lbl, text);
  };
}

/** Configuration for `createChart`. */
export interface ChartConfig {
  readonly box: readonly [number, number];
  readonly pad?: readonly [number, number, number, number];
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly ticksX?: readonly number[];
  readonly ticksY?: readonly number[];
  readonly fmtY?: (val: number) => string;
  readonly labelX?: string;
  readonly labelY?: string;
}

interface ChartLayout {
  readonly boxW: number; readonly boxH: number; readonly x0: number; readonly y0: number;
  readonly x1: number; readonly y1: number; readonly w: number; readonly h: number;
  readonly sx: LinearScale; readonly sy: LinearScale;
}

type Accessor<D> = (datum: D, index: number) => number;
type SeriesUpdater<D> = (data: readonly D[], clsNext?: string, show?: boolean) => void;
type BandUpdater = (xA: number, xB: number, show?: boolean, label?: string) => void;
type RuleUpdater = (xVal: number, show?: boolean) => void;
type ColsUpdater<D> = (data: readonly D[], clsFn: (datum: D, index: number) => string) => void;

interface HruleSpec { readonly y: number; readonly cls: string; readonly label?: string; readonly align?: 'start' | 'end'; readonly dy?: number }
interface VbandSpec { readonly cls: string; readonly label?: string; readonly yTop?: number; readonly yBot?: number }
interface DotsSpec<D> { readonly radius: number; readonly x: Accessor<D>; readonly y: Accessor<D>; readonly cls: string }

/** Hoisted SVG chart layer handle returned by `createChart`. */
export interface ChartHandle extends ChartLayout {
  readonly bodyEl: SVGGElement;
  readonly overlayEl: SVGGElement;
  readonly svgNode: SVGSVGElement;
  readonly setLabelX: (text: string) => void;
  readonly hband: (yA: number, yB: number, cls: string) => void;
  readonly hrule: (spec: HruleSpec) => void;
  readonly vband: (spec: VbandSpec) => BandUpdater;
  readonly vrule: (cls: string, label?: string) => RuleUpdater;
  readonly cols: <D>(widthDomain: number, xLeftFn: Accessor<D>) => ColsUpdater<D>;
  readonly area: <D>(xFn: Accessor<D>, y0Fn: Accessor<D>, y1Fn: Accessor<D>, cls: string) => SeriesUpdater<D>;
  readonly line: <D>(xFn: Accessor<D>, yFn: Accessor<D>, cls: string) => SeriesUpdater<D>;
  readonly dots: <D>(spec: DotsSpec<D>) => SeriesUpdater<D>;
  readonly badge: () => BadgeUpdater;
}

interface ChartLayerCtx { readonly body: Sel<SVGGElement>; readonly bodyEl: SVGGElement; readonly overlayEl: SVGGElement; readonly layout: ChartLayout }

let clipSeq = 0;

function computeChartLayout(cfg: ChartConfig): ChartLayout {
  const [boxW, boxH] = cfg.box;
  const [pt, pr, pb, pl] = cfg.pad ?? CHART_CFG.pad;
  const x0 = pl;
  const y0 = pt;
  const x1 = boxW - pr;
  const y1 = boxH - pb;
  return { boxW, boxH, x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, sx: linearScale(cfg.x, [x0, x1]), sy: linearScale(cfg.y, [y1, y0], true) };
}

function buildTicksGroup(cfg: ChartConfig, layout: ChartLayout, isX: boolean): SVGGElement | null {
  const ticks = isX ? cfg.ticksX : cfg.ticksY;
  if (!ticks?.length) {
    return null;
  }
  const nodes = ticks.map((val) => svgEl('g', { cls: 'tick', transform: isX ? `translate(${layout.sx(val)},0)` : `translate(0,${layout.sy(val)})` }, svgEl('line', isX ? { y2: 3 } : { x2: layout.w }), svgEl('text', isX ? { y: 7, dy: '0.71em', 'text-anchor': 'middle' } : { x: -5, dy: '0.32em', 'text-anchor': 'end' }, isX ? String(val) : cfg.fmtY ? cfg.fmtY(val) : String(val))));
  return svgEl('g', { cls: `viz-axis viz-axis-${isX ? 'x' : 'y'}`, transform: isX ? `translate(0,${layout.y1})` : `translate(${layout.x0},0)` }, ...nodes);
}

function renderChartChrome(svgNode: SVGSVGElement, cfg: ChartConfig, layout: ChartLayout): SVGTextElement | null {
  patchAttrs(svgNode, { viewBox: `0 0 ${layout.boxW} ${layout.boxH}`, width: layout.boxW, height: layout.boxH });
  svgNode.append(svgEl('rect', { cls: 'viz-plot-bg', x: layout.x0, y: layout.y0, width: layout.w, height: layout.h }));
  for (const axisG of [buildTicksGroup(cfg, layout, false), buildTicksGroup(cfg, layout, true)]) {
    if (axisG) {
      svgNode.append(axisG);
    }
  }
  if (cfg.labelY) {
    svgNode.append(svgEl('text', { cls: 'viz-axis-title', transform: `translate(${CHART_CFG.axisTitleX},${layout.y0 + layout.h * 0.5}) rotate(-90)`, 'text-anchor': 'middle' }, cfg.labelY));
  }
  if (cfg.labelX === undefined) {
    return null;
  }
  const lblX = svgEl('text', { cls: 'viz-axis-title', x: layout.x0 + layout.w * 0.5, y: layout.boxH - 3, 'text-anchor': 'middle' }, cfg.labelX);
  svgNode.append(lblX);
  return lblX;
}

function createPathUpdater<D>(pathEl: SVGPathElement, baseCls: string, initCls: string, gen: (data: readonly D[]) => string | null): SeriesUpdater<D> {
  let prevData: readonly D[] | null = null;
  return (data, clsNext = initCls, show = true) => {
    setShow(pathEl, show);
    if (!show) {
      return;
    }
    patchAttrs(pathEl, { cls: `${baseCls} ${clsNext}` });
    if (data !== prevData) {
      prevData = data;
      patchAttrs(pathEl, { d: gen(data) ?? '' });
    }
  };
}

function drawHrule(ctx: ChartLayerCtx, spec: HruleSpec): void {
  const { x0, x1, sy } = ctx.layout;
  const py = sy(spec.y);
  const align = spec.align ?? 'end';
  ctx.bodyEl.append(svgEl('line', { cls: `viz-rule ${spec.cls}`, x1: x0, x2: x1, y1: py, y2: py }));
  if (spec.label !== undefined) {
    ctx.overlayEl.append(svgEl('text', { cls: `viz-rule-lbl ${spec.cls}`, x: align === 'end' ? x1 - 5 : x0 + 5, y: py + (spec.dy ?? -4), 'text-anchor': align }, spec.label));
  }
}

function createVbandLayer(ctx: ChartLayerCtx, spec: VbandSpec): BandUpdater {
  const { sx, sy, y0, y1 } = ctx.layout;
  const rect = svgEl('rect', { cls: `viz-band ${spec.cls}` });
  ctx.bodyEl.append(rect);
  const textEl = spec.label !== undefined ? svgEl('text', { cls: `viz-rule-lbl ${spec.cls}`, 'text-anchor': 'start' }) : null;
  if (textEl) {
    ctx.overlayEl.append(textEl);
  }
  return (xA, xB, show = true, label = spec.label ?? '') => {
    setShow(rect, show);
    setShow(textEl, show);
    if (!show) {
      return;
    }
    const xa = sx(xA);
    const xb = sx(xB);
    const ya = spec.yTop !== undefined ? sy(spec.yTop) : y0;
    const yb = spec.yBot !== undefined ? sy(spec.yBot) : y1;
    const left = Math.min(xa, xb);
    const width = Math.max(0, Math.abs(xb - xa));
    patchAttrs(rect, { x: left, y: Math.min(ya, yb), width, height: Math.abs(yb - ya) });
    if (textEl) {
      patchAttrs(textEl, { x: left + 4, y: y0 + 11 });
      setText(textEl, width > CHART_CFG.vbandMinLabelW ? label : '');
    }
  };
}

function createVruleLayer(ctx: ChartLayerCtx, cls: string, label?: string): RuleUpdater {
  const { sx, y0, y1 } = ctx.layout;
  const ln = svgEl('line', { cls: `viz-rule ${cls}`, y1: y0, y2: y1 });
  ctx.bodyEl.append(ln);
  const tx = label !== undefined ? svgEl('text', { cls: `viz-rule-lbl ${cls}`, y: y0 >= 12 ? y0 - 4 : y0 + 10, 'text-anchor': 'middle' }, label) : null;
  if (tx) {
    ctx.overlayEl.append(tx);
  }
  return (xVal, show = true) => {
    setShow(ln, show);
    setShow(tx, show);
    if (show) {
      const px = sx(xVal);
      patchAttrs(ln, { x1: px, x2: px });
      if (tx) {
        patchAttrs(tx, { x: px });
      }
    }
  };
}

function createColsLayer<D>(ctx: ChartLayerCtx, widthDomain: number, xLeftFn: Accessor<D>): ColsUpdater<D> {
  const { sx, y0, h } = ctx.layout;
  const wrap = ctx.body.append('g');
  return (data, clsFn) => {
    wrap.selectAll<SVGRectElement, D>('rect').data(data).join('rect').attr('y', y0).attr('height', h)
      .attr('class', (d, i) => `viz-col ${clsFn(d, i)}`).attr('x', (d, i) => sx(xLeftFn(d, i)))
      .attr('width', (d, i) => Math.max(0.5, sx(xLeftFn(d, i) + widthDomain) - sx(xLeftFn(d, i))));
  };
}

function createDotsLayer<D>(ctx: ChartLayerCtx, spec: DotsSpec<D>): SeriesUpdater<D> {
  const { sx, sy } = ctx.layout;
  const wrap = ctx.body.append('g');
  return (data, clsNext = spec.cls, show = true) => {
    setShow(wrap.node(), show);
    if (show) {
      wrap.selectAll<SVGCircleElement, D>('circle').data(data).join('circle').attr('class', `viz-dot ${clsNext}`)
        .attr('cx', (d, i) => sx(spec.x(d, i))).attr('cy', (d, i) => sy(spec.y(d, i))).attr('r', spec.radius);
    }
  };
}

function createAreaLayer<D>(ctx: ChartLayerCtx, cls: string, xFn: Accessor<D>, yBounds: readonly [Accessor<D>, Accessor<D>]): SeriesUpdater<D> {
  const pathEl = svgEl('path', { cls: `viz-area ${cls}` });
  ctx.bodyEl.append(pathEl);
  const gen = d3Area<D>().x((d, i) => ctx.layout.sx(xFn(d, i))).y0((d, i) => ctx.layout.sy(yBounds[0](d, i))).y1((d, i) => ctx.layout.sy(yBounds[1](d, i))).curve(monotoneX);
  return createPathUpdater(pathEl, 'viz-area', cls, gen);
}

function createLineLayer<D>(ctx: ChartLayerCtx, xFn: Accessor<D>, yFn: Accessor<D>, cls: string): SeriesUpdater<D> {
  const pathEl = svgEl('path', { cls: `viz-line ${cls}` });
  ctx.bodyEl.append(pathEl);
  const gen = d3Line<D>().x((d, i) => ctx.layout.sx(xFn(d, i))).y((d, i) => ctx.layout.sy(yFn(d, i))).curve(monotoneX);
  return createPathUpdater(pathEl, 'viz-line', cls, gen);
}

function buildChartHandle(svgNode: SVGSVGElement, lblX: SVGTextElement | null, ctx: ChartLayerCtx): ChartHandle {
  const { layout, bodyEl, overlayEl } = ctx;
  return {
    ...layout, bodyEl, overlayEl, svgNode,
    setLabelX(text) {
      setText(lblX, text);
    },
    hband(yA, yB, cls) {
      const pyA = layout.sy(yA);
      const pyB = layout.sy(yB);
      bodyEl.append(svgEl('rect', { cls: `viz-band ${cls}`, x: layout.x0, width: layout.w, y: Math.min(pyA, pyB), height: Math.abs(pyB - pyA) }));
    },
    hrule(spec) {
      drawHrule(ctx, spec);
    },
    vband: (spec) => createVbandLayer(ctx, spec),
    vrule: (cls, label) => createVruleLayer(ctx, cls, label),
    cols: (widthDomain, xLeftFn) => createColsLayer(ctx, widthDomain, xLeftFn),
    area: (xFn, y0Fn, y1Fn, cls) => createAreaLayer(ctx, cls, xFn, [y0Fn, y1Fn]),
    line: (xFn, yFn, cls) => createLineLayer(ctx, xFn, yFn, cls),
    dots: (spec) => createDotsLayer(ctx, spec),
    badge: () => mountBadge(overlayEl, layout.x0 + CHART_CFG.badgeInset, layout.y0 + CHART_CFG.badgeInset),
  };
}

/** Creates a Cartesian SVG chart with pure layout computation, clipped body, and overlay layers. */
export function createChart(svgNode: SVGSVGElement, cfg: ChartConfig): ChartHandle {
  const layout = computeChartLayout(cfg);
  const lblX = renderChartChrome(svgNode, cfg, layout);
  clipSeq += 1;
  const clipId = `viz-clip-${clipSeq}`;
  const bodyEl = svgEl('g', { cls: 'viz-plot-body', 'clip-path': `url(#${clipId})` });
  const overlayEl = svgEl('g', { cls: 'viz-plot-overlay' });
  svgNode.append(
    svgEl('defs', null, svgEl('clipPath', { id: clipId }, svgEl('rect', { x: layout.x0, y: layout.y0, width: layout.w, height: layout.h }))),
    bodyEl, svgEl('rect', { cls: 'viz-plot-frame', x: layout.x0, y: layout.y0, width: layout.w, height: layout.h }), overlayEl,
  );
  return buildChartHandle(svgNode, lblX, { body: select(bodyEl), bodyEl, overlayEl, layout });
}

/** Computes a straight SVG path `M...L...` trimmed by `padStart` and `padEnd` from endpoints. */
export function rayEdge(start: { readonly x: number; readonly y: number }, end: { readonly x: number; readonly y: number }, padStart: number, padEnd: number): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return `M${(start.x + ux * padStart).toFixed(1)},${(start.y + uy * padStart).toFixed(1)}L${(end.x - ux * padEnd).toFixed(1)},${(end.y - uy * padEnd).toFixed(1)}`;
}

/** Column header pill above a topology diagram. */
export interface TopoHeaderDef { readonly x: number; readonly y: number; readonly w: number; readonly label: string; readonly cls?: string }

/** Directed or undirected edge in an SVG topology diagram. */
export interface TopoEdgeDef {
  readonly id: string; readonly d: string; readonly cls?: string; readonly arrow?: boolean;
  readonly label?: string; readonly lx?: number; readonly ly?: number; readonly anchor?: 'start' | 'middle' | 'end'; readonly show?: boolean;
}

interface TopoNodeBase {
  readonly id: string; readonly x: number; readonly y: number; readonly label: string;
  readonly cls?: string; readonly tip?: string; readonly click?: boolean; readonly focusable?: boolean;
}

type CircleNodeDef = TopoNodeBase & { readonly kind: 'circle'; readonly r?: number; readonly sub?: string; readonly subSide?: 'bottom' | 'right' };

/** Discriminated union of topology node shapes. */
export type TopoNodeDef =
  | (TopoNodeBase & { readonly kind: 'card'; readonly w?: number; readonly h?: number; readonly sub?: string })
  | (TopoNodeBase & { readonly kind: 'pill'; readonly w?: number; readonly h?: number })
  | CircleNodeDef;

/** Incremental attribute/state patch for a topology node. */
export interface NodePatch {
  readonly cls?: string; readonly label?: string; readonly sub?: string; readonly ring?: '' | 'solid' | 'dashed';
  readonly tip?: string | null; readonly clickable?: boolean; readonly pressed?: boolean | null; readonly ariaLabel?: string;
}

/** Incremental attribute/visibility patch for a topology edge. */
export interface EdgePatch { readonly cls?: string; readonly label?: string; readonly arrow?: boolean; readonly show?: boolean }

/** Batch update payload consumed by a `renderTopo` updater function. */
export interface TopoPatch { readonly nodes?: Readonly<Record<string, NodePatch>>; readonly edges?: Readonly<Record<string, EdgePatch>>; readonly footer?: string }

/** Declarative topology configuration passed to `renderTopo`. */
export interface TopoConfig {
  readonly box: readonly [number, number]; readonly headers?: readonly TopoHeaderDef[];
  readonly edges: readonly TopoEdgeDef[]; readonly nodes: readonly TopoNodeDef[];
  readonly footer?: string; readonly onNodeClick?: (id: string) => void;
}

interface TopoEdgeEntry { readonly grp: SVGGElement; readonly path: SVGPathElement; readonly lbl: SVGTextElement | null }
interface TopoNodeEntry {
  readonly def: TopoNodeDef; readonly el: SVGGElement; readonly title: SVGTextElement;
  readonly sub: SVGTextElement | null; readonly ring: SVGCircleElement | null;
  tone: string; clickable: boolean; pressed: boolean | null; ariaLabel: string;
}

let arrowSeq = 0;

function nodeA11yAttrs(entry: TopoNodeEntry): AttrMap {
  const { def, clickable, pressed, ariaLabel } = entry;
  if (def.click || clickable) {
    return {
      role: 'button', 'aria-label': ariaLabel || def.label, 'aria-pressed': pressed !== null ? String(pressed) : null,
      tabindex: clickable ? 0 : null, 'aria-disabled': clickable ? null : 'true',
    };
  }
  return { role: null, 'aria-label': def.focusable ? ariaLabel || def.label : null, 'aria-pressed': null, tabindex: def.focusable ? 0 : null, 'aria-disabled': null };
}

function buildCircleNodeBody(def: CircleNodeDef): { readonly children: readonly SVGElement[]; readonly title: SVGTextElement; readonly sub: SVGTextElement | null; readonly ring: SVGCircleElement } {
  const r = def.r ?? TOPO_CFG.circleR;
  const ring = svgEl('circle', { r: r + TOPO_CFG.ringPad, cls: 'viz-node-ring' });
  setShow(ring, false);
  const title = svgEl('text', { y: 3.5, 'text-anchor': 'middle', cls: 'viz-node-title' }, def.label);
  const sub = def.sub !== undefined
    ? svgEl('text', def.subSide === 'right' ? { x: r + 6, y: 4, 'text-anchor': 'start', cls: 'viz-node-sub' } : { y: r + 11.5, 'text-anchor': 'middle', cls: 'viz-node-sub' }, def.sub)
    : null;
  return { children: [ring, svgEl('circle', { r, cls: 'viz-node-shape' }), title, ...(sub ? [sub] : [])], title, sub, ring };
}

function buildTopoNodeBody(def: TopoNodeDef): { readonly children: readonly SVGElement[]; readonly title: SVGTextElement; readonly sub: SVGTextElement | null; readonly ring: SVGCircleElement | null } {
  if (def.kind === 'card') {
    const w = def.w ?? TOPO_CFG.cardW;
    const h = def.h ?? TOPO_CFG.cardH;
    const title = svgEl('text', { x: 0.5 * w, y: 17, 'text-anchor': 'middle', cls: 'viz-node-title' }, def.label);
    const sub = svgEl('text', { x: 0.5 * w, y: 32, 'text-anchor': 'middle', cls: 'viz-node-sub' }, def.sub ?? '');
    return { children: [svgEl('rect', { width: w, height: h, rx: TOPO_CFG.cardRx, cls: 'viz-node-shape' }), title, sub], title, sub, ring: null };
  }
  if (def.kind === 'pill') {
    const w = def.w ?? TOPO_CFG.pillW;
    const h = def.h ?? TOPO_CFG.pillH;
    const title = svgEl('text', { y: 3.5, 'text-anchor': 'middle', cls: 'viz-node-title' }, def.label);
    return { children: [svgEl('rect', { x: -0.5 * w, y: -0.5 * h, width: w, height: h, rx: TOPO_CFG.pillRx, cls: 'viz-node-shape' }), title], title, sub: null, ring: null };
  }
  if (def.kind === 'circle') {
    return buildCircleNodeBody(def);
  }
  return assertNever(def);
}

function createTopoNodeEntry(def: TopoNodeDef, onNodeClick?: (id: string) => void): TopoNodeEntry {
  const clickable = Boolean(def.click);
  const tone = def.cls ?? '';
  const body = buildTopoNodeBody(def);
  const el = svgEl('g', { transform: `translate(${def.x},${def.y})`, cls: `viz-node is-${def.kind}${tone ? ` ${tone}` : ''}${clickable ? ' is-clickable' : ''}`, 'data-tip': def.tip ?? null }, ...body.children);
  const entry: TopoNodeEntry = { def, el, title: body.title, sub: body.sub, ring: body.ring, tone, clickable, pressed: null, ariaLabel: def.label };
  patchAttrs(el, nodeA11yAttrs(entry));
  if (onNodeClick) {
    function activate(): void {
      if (entry.clickable && onNodeClick) {
        onNodeClick(def.id);
      }
    }
    el.addEventListener('click', activate);
    el.addEventListener('keydown', (evt: KeyboardEvent) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        activate();
      }
    });
  }
  return entry;
}

function patchTopoNode(entry: TopoNodeEntry, patch: NodePatch): void {
  entry.clickable = patch.clickable ?? entry.clickable;
  if (patch.pressed !== undefined) {
    entry.pressed = patch.pressed;
  }
  entry.ariaLabel = patch.ariaLabel ?? entry.ariaLabel;
  entry.tone = patch.cls ?? entry.tone;
  patchAttrs(entry.el, {
    ...nodeA11yAttrs(entry),
    cls: `viz-node is-${entry.def.kind}${entry.tone ? ` ${entry.tone}` : ''}${entry.clickable ? ' is-clickable' : ''}`,
    ...(patch.tip !== undefined ? { 'data-tip': patch.tip || null } : {}),
  });
  setText(entry.title, patch.label ?? entry.title.textContent ?? '');
  if (patch.sub !== undefined) {
    setText(entry.sub, patch.sub);
  }
  if (patch.ring !== undefined && entry.ring) {
    setShow(entry.ring, Boolean(patch.ring));
    if (patch.ring) {
      patchAttrs(entry.ring, { cls: `viz-node-ring ${patch.ring === 'dashed' ? 'is-dashed' : 'is-solid'}` });
    }
  }
}

function createTopoEdgeEntry(edgeDef: TopoEdgeDef, arrowId: string): TopoEdgeEntry {
  const cls = edgeDef.cls ?? '';
  const path = svgEl('path', { d: edgeDef.d, cls: `viz-edge${cls ? ` ${cls}` : ''}`, 'marker-end': edgeDef.arrow !== false ? `url(#${arrowId})` : null });
  const lbl = edgeDef.lx !== undefined ? svgEl('text', { x: edgeDef.lx, y: edgeDef.ly ?? 0, 'text-anchor': edgeDef.anchor ?? 'middle', cls: `viz-edge-lbl${cls ? ` ${cls}` : ''}` }, edgeDef.label ?? '') : null;
  const grp = svgEl('g', null, path, ...(lbl ? [lbl] : []));
  setShow(grp, edgeDef.show !== false);
  return { grp, path, lbl };
}

function patchTopoEdge(entry: TopoEdgeEntry, patch: EdgePatch, arrowId: string): void {
  if (patch.show !== undefined) {
    setShow(entry.grp, patch.show);
  }
  if (patch.cls !== undefined) {
    patchAttrs(entry.path, { cls: `viz-edge ${patch.cls}` });
    if (entry.lbl) {
      patchAttrs(entry.lbl, { cls: `viz-edge-lbl ${patch.cls}` });
    }
  }
  if (patch.arrow !== undefined) {
    patchAttrs(entry.path, { 'marker-end': patch.arrow ? `url(#${arrowId})` : null });
  }
  if (patch.label !== undefined) {
    setText(entry.lbl, patch.label);
  }
}

function buildTopoHeader(hdr: TopoHeaderDef): SVGGElement {
  const mod = hdr.cls ? ` ${hdr.cls}` : '';
  return svgEl('g', { transform: `translate(${hdr.x},${hdr.y})` }, svgEl('rect', { x: -0.5 * hdr.w, y: -9, width: hdr.w, height: TOPO_CFG.hdrH, rx: TOPO_CFG.hdrRx, cls: `viz-hdr-pill${mod}` }), svgEl('text', { y: 3, 'text-anchor': 'middle', cls: `viz-hdr-txt${mod}` }, hdr.label));
}

function applyTopoPatch(patch: TopoPatch, nodeMap: ReadonlyMap<string, TopoNodeEntry>, edgeMap: ReadonlyMap<string, TopoEdgeEntry>, ctx: { readonly arrowId: string; readonly footEl: SVGTextElement | null }): void {
  if (patch.footer !== undefined) {
    setText(ctx.footEl, patch.footer);
  }
  for (const [id, np] of Object.entries(patch.nodes ?? {})) {
    const entry = nodeMap.get(id);
    if (entry) {
      patchTopoNode(entry, np);
    }
  }
  for (const [id, ep] of Object.entries(patch.edges ?? {})) {
    const entry = edgeMap.get(id);
    if (entry) {
      patchTopoEdge(entry, ep, ctx.arrowId);
    }
  }
}

/** Renders an accessible SVG node-and-edge topology diagram and returns an idempotent patcher. */
export function renderTopo(svgNode: SVGSVGElement, cfg: TopoConfig): (patch: TopoPatch) => void {
  const [boxW, boxH] = cfg.box;
  patchAttrs(svgNode, { viewBox: `0 0 ${boxW} ${boxH}`, width: boxW, height: boxH });
  arrowSeq += 1;
  const defs = svgEl('defs');
  svgNode.append(defs);
  const arrowId = addArrowMarker(defs, `viz-arrow-${arrowSeq}`);
  if (cfg.headers?.length) {
    svgNode.append(svgEl('g', null, ...cfg.headers.map(buildTopoHeader)));
  }
  const edgeEntries = cfg.edges.map((e) => [e.id, createTopoEdgeEntry(e, arrowId)] as const);
  const nodeEntries = cfg.nodes.map((n) => [n.id, createTopoNodeEntry(n, cfg.onNodeClick)] as const);
  const footEl = cfg.footer !== undefined ? svgEl('text', { x: 0.5 * boxW, y: boxH - 6, 'text-anchor': 'middle', cls: 'viz-graph-foot' }, cfg.footer) : null;
  svgNode.append(svgEl('g', null, ...edgeEntries.map(([, entry]) => entry.grp)), svgEl('g', null, ...nodeEntries.map(([, entry]) => entry.el)), ...(footEl ? [footEl] : []));
  const nodeMap = new Map(nodeEntries);
  const edgeMap = new Map(edgeEntries);
  return (patch) => {
    applyTopoPatch(patch, nodeMap, edgeMap, { arrowId, footEl });
  };
}
