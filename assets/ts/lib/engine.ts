/**
 * @fileoverview Core numeric/functional combinators, idempotent HTML/SVG DOM
 * patchers, passive tooltip/viewport observers, and declarative figure engine.
 */

const ENGINE_CFG = {
  vizSel: '.viz', mountSel: '.viz-mount', tipId: 'fx-tip', tipAttr: 'data-tip',
  tipPad: 8, tipW: 220, tipH: 52, tipGapTop: 10, tipGapBot: 12,
  ioThreshold: 0.05, memoCap: 8, rngSeed: 0.421337, rngMod: 4294967296,
  lcgMul: 1664525, lcgInc: 1013904223,
} as const;

/** Exhaustiveness helper for discriminated unions. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${String(value)}`);
}

/** Clamps `value` to `[lo, hi]`, returning `lo` when `value` is `NaN`. */
export function clamp(value: number, lo: number, hi: number): number {
  return Number.isNaN(value) || value < lo ? lo : value > hi ? hi : value;
}

/** Linearly interpolates between `start` and `end` at fraction `t`. */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Formats `value` with fixed `digits`, explicit `+`/`−` sign when non-zero, and optional `unit`. */
export function fmtSigned(value: number, digits = 1, unit = ''): string {
  const absText = Math.abs(value).toFixed(digits);
  const rounded = Number(absText);
  const sign = !Number.isFinite(rounded) || rounded === 0 ? '' : value > 0 ? '+' : '−';
  return `${sign}${absText}${unit}`;
}

/** Returns `[0, 1, ..., count - 1]`. */
export function range(count: number): number[] {
  return Array.from({ length: count }, (_, idx) => idx);
}

/** Sums `fn(item, index)` across `items`. */
export function sum<T>(items: readonly T[], fn: (item: T, index: number) => number): number {
  return items.reduce((acc, item, idx) => acc + fn(item, idx), 0);
}

/** Computes the arithmetic mean of `fn(item, index)` across `items`, or `0` if empty. */
export function mean<T>(items: readonly T[], fn: (item: T, index: number) => number): number {
  return items.length ? sum(items, fn) / items.length : 0;
}

/** Returns the index of the element in `items` maximizing `fn(item, index)`. */
export function maxIndex<T>(items: readonly T[], fn: (item: T, index: number) => number): number {
  return items.reduce((best, item, idx) => {
    const score = fn(item, idx);
    return score > best.score ? { idx, score } : best;
  }, { idx: 0, score: -Infinity }).idx;
}

/** Applies `stepFn` `steps` times starting from `seed`. */
export function iterate<T>(steps: number, seed: T, stepFn: (state: T, index: number) => T): T {
  return range(steps).reduce((acc, idx) => stepFn(acc, idx), seed);
}

/** Appends `item` to a bounded immutable ring buffer of maximum length `capacity`. */
export function pushRing<T>(items: readonly T[], item: T, capacity: number): readonly T[] {
  return capacity <= 1 ? [item] : [...items.slice(1 - capacity), item];
}

/** Evaluates ordered `[condition, result]` rules and returns the first match or `fallback`. */
export function matchRule<T>(rules: ReadonlyArray<readonly [boolean, T]>, fallback: T): T {
  const hit = rules.find(([when]) => when);
  return hit ? hit[1] : fallback;
}

/** Maps `items` into a string-keyed dictionary via `Object.fromEntries`. */
export function toRecord<T, V>(items: readonly T[], entryFn: (item: T, index: number) => readonly [string, V]): Record<string, V> {
  return Object.fromEntries(items.map(entryFn));
}

/** Wraps `fn` in a bounded LRU cache keyed by `Object.is` argument equality. */
export function memoBy<K extends readonly unknown[], R>(fn: (...args: K) => R, capacity: number = ENGINE_CFG.memoCap): (...args: K) => R {
  const slots: Array<{ readonly key: K; readonly value: R }> = [];
  return (...args: K): R => {
    const idx = slots.findIndex((s) => s.key.length === args.length && args.every((arg, i) => Object.is(arg, s.key[i])));
    if (idx >= 0) {
      const [hit] = slots.splice(idx, 1);
      slots.unshift(hit);
      return hit.value;
    }
    const value = fn(...args);
    slots.unshift({ key: args, value });
    if (slots.length > capacity) {
      slots.pop();
    }
    return value;
  };
}

/** Invertible 1D linear coordinate scale. */
export interface LinearScale {
  (domainValue: number): number;
  invert(rangeValue: number): number;
}

/** Constructs an invertible linear scale mapping `domain` to `rangeOut`. */
export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number], clamped = false): LinearScale {
  const dSpan = d1 - d0 || 1;
  const rSpan = r1 - r0 || 1;
  function norm(t: number): number {
    return clamped ? clamp(t, 0, 1) : t;
  }
  return Object.assign((x: number): number => r0 + norm((x - d0) / dSpan) * rSpan, {
    invert: (y: number): number => d0 + norm((y - r0) / rSpan) * dSpan,
  });
}

/** Deterministic pseudo-random number generator with uniform and standard-normal variates. */
export interface Rng {
  next(): number;
  gauss(): number;
}

/** Creates a seeded LCG + Box-Muller Gaussian PRNG. */
export function createRng(seed: number = ENGINE_CFG.rngSeed): Rng {
  let state = ((seed * ENGINE_CFG.rngMod) >>> 0) || 1;
  function next(): number {
    state = (Math.imul(ENGINE_CFG.lcgMul, state) + ENGINE_CFG.lcgInc) >>> 0;
    return state / ENGINE_CFG.rngMod;
  }
  function gauss(): number {
    return Math.sqrt(-2 * Math.log(Math.max(1e-9, next()))) * Math.cos(2 * Math.PI * next());
  }
  return { next, gauss };
}

type AttrPrimitive = string | number | boolean;
type DomChild = Node | string | number | false;

/** Declarative attribute map where `cls` aliases `class` and `false`/`null`/`undefined` remove attributes. */
export type AttrMap = Readonly<Record<string, AttrPrimitive | null | undefined>>;

/** Idempotently patches attributes on `el`, mutating the DOM only when values change. */
export function patchAttrs(el: Element, attrs: AttrMap): void {
  for (const [key, val] of Object.entries(attrs)) {
    const name = key === 'cls' ? 'class' : key;
    if (val === null || val === undefined || val === false) {
      if (el.hasAttribute(name)) {
        el.removeAttribute(name);
      }
      continue;
    }
    const next = val === true ? '' : String(val);
    if (el.getAttribute(name) !== next) {
      el.setAttribute(name, next);
    }
  }
}

/** Idempotently updates `textContent` on `node` when it differs from `text`. */
export function setText(node: Node | null | undefined, text: string): void {
  if (node && node.textContent !== text) {
    node.textContent = text;
  }
}

/** Idempotently toggles inline `display: none` on `el`. */
export function setShow(el: HTMLElement | SVGElement | null | undefined, show: boolean): void {
  const next = show ? '' : 'none';
  if (el && el.style.display !== next) {
    el.style.display = next;
  }
}

/** Creates a typed HTML element with attributes, `on*` event listeners, and children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Readonly<Record<string, AttrPrimitive | EventListener | null | undefined>> | null,
  ...children: ReadonlyArray<DomChild | null | undefined>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs ?? {})) {
    if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (typeof val !== 'function') {
      patchAttrs(el, { [key]: val });
    }
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) {
      el.append(child instanceof Node ? child : String(child));
    }
  }
  return el;
}

/** Creates a typed SVG element in the SVG namespace with attributes and children. */
export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: AttrMap | null, ...children: ReadonlyArray<Node | string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    patchAttrs(el, attrs);
  }
  el.append(...children);
  return el;
}

function parseRichLine(line: string): Array<Node | string> {
  const out: Array<Node | string> = [];
  let cursor = 0;
  for (const match of line.matchAll(/\*\*([^*]+)\*\*|`([^`]+)`/g)) {
    const idx = match.index ?? 0;
    if (idx > cursor) {
      out.push(line.slice(cursor, idx));
    }
    out.push(match[1] ? h('strong', null, match[1]) : h('code', null, match[2]));
    cursor = idx + match[0].length;
  }
  if (cursor < line.length) {
    out.push(line.slice(cursor));
  }
  return out;
}

function richNodes(text: string): Array<Node | string> {
  return text.split('\n').flatMap((line, idx) => (idx > 0 ? [document.createElement('br'), ...parseRichLine(line)] : parseRichLine(line)));
}

interface TipAnchor { readonly cx: number; readonly cyTop: number; readonly cyBot: number }
interface TooltipCtrl {
  readonly hasActive: () => boolean;
  readonly show: (target: Element, raw: string, pos: TipAnchor) => void;
  readonly hide: () => void;
}

function placeTooltip(tip: HTMLElement, dims: readonly [number, number], pos: TipAnchor): void {
  const pad = ENGINE_CFG.tipPad;
  const x = clamp(pos.cx - dims[0] * 0.5, pad, Math.max(pad, window.innerWidth - dims[0] - pad));
  const above = pos.cyTop - dims[1] - ENGINE_CFG.tipGapTop;
  const y = above >= pad ? above : clamp(pos.cyBot + ENGINE_CFG.tipGapBot, pad, Math.max(pad, window.innerHeight - dims[1] - pad));
  tip.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
}

function clearTipDesc(el: Element | null): void {
  if (el?.getAttribute('aria-describedby') === ENGINE_CFG.tipId) {
    el.removeAttribute('aria-describedby');
  }
}

function createTooltipCtrl(): TooltipCtrl {
  const tip = h('div', { id: ENGINE_CFG.tipId, cls: 'fx-tip', role: 'tooltip' });
  document.body.append(tip);
  let lastEl: Element | null = null;
  let lastRaw = '';
  let dims: readonly [number, number] = [ENGINE_CFG.tipW, ENGINE_CFG.tipH];
  function hide(): void {
    clearTipDesc(lastEl);
    lastEl = null;
    lastRaw = '';
    tip.classList.remove('is-visible');
  }
  function show(target: Element, raw: string, pos: TipAnchor): void {
    if (target !== lastEl || raw !== lastRaw) {
      clearTipDesc(lastEl);
      lastEl = target;
      lastRaw = raw;
      patchAttrs(target, { 'aria-describedby': ENGINE_CFG.tipId });
      tip.replaceChildren(...richNodes(raw));
      tip.classList.add('is-visible');
      dims = [tip.offsetWidth || ENGINE_CFG.tipW, tip.offsetHeight || ENGINE_CFG.tipH];
    }
    placeTooltip(tip, dims, pos);
  }
  return { hasActive: () => lastEl !== null, show, hide };
}

function bindTooltipMoveAndFocus(ctrl: TooltipCtrl): void {
  document.addEventListener('pointermove', (event: PointerEvent) => {
    const rawTarget = event.pointerType !== 'touch' && event.target instanceof Element ? event.target : null;
    if (!rawTarget || (!ctrl.hasActive() && !rawTarget.closest(ENGINE_CFG.vizSel))) {
      return;
    }
    const target = rawTarget.closest(`[${ENGINE_CFG.tipAttr}]`);
    const raw = target?.getAttribute(ENGINE_CFG.tipAttr);
    if (!target || !raw) {
      ctrl.hide();
      return;
    }
    ctrl.show(target, raw, { cx: event.clientX, cyTop: event.clientY, cyBot: event.clientY });
  }, { passive: true });
  document.addEventListener('focusin', (event: FocusEvent) => {
    const target = event.target instanceof Element ? event.target.closest(`[${ENGINE_CFG.tipAttr}]`) : null;
    const raw = target?.getAttribute(ENGINE_CFG.tipAttr);
    if (target && raw) {
      const rect = target.getBoundingClientRect();
      ctrl.show(target, raw, { cx: rect.left + rect.width * 0.5, cyTop: rect.top, cyBot: rect.bottom });
    }
  });
}

let tipBound = false;

function bindGlobalTooltip(): void {
  if (tipBound || typeof document === 'undefined') {
    return;
  }
  tipBound = true;
  const ctrl = createTooltipCtrl();
  bindTooltipMoveAndFocus(ctrl);
  for (const evt of ['pointerdown', 'pointercancel', 'focusout'] as const) {
    document.addEventListener(evt, ctrl.hide, { passive: true });
  }
  document.addEventListener('scroll', ctrl.hide, { capture: true, passive: true });
  document.documentElement.addEventListener('pointerleave', ctrl.hide, { passive: true });
  window.addEventListener('blur', ctrl.hide);
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      ctrl.hide();
    }
  });
}

const ioTargets = new Map<Element, (inView: boolean) => void>();
const visSyncers = new Set<() => void>();
let sharedIo: IntersectionObserver | null = null;
let visBound = false;

function observeVisibility(el: Element, onView: (inView: boolean) => void, onDocVis: () => void): void {
  if (typeof IntersectionObserver !== 'undefined') {
    sharedIo ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        ioTargets.get(entry.target)?.(entry.isIntersecting);
      }
    }, { threshold: ENGINE_CFG.ioThreshold });
    ioTargets.set(el, onView);
    sharedIo.observe(el);
  }
  visSyncers.add(onDocVis);
  if (!visBound) {
    visBound = true;
    document.addEventListener('visibilitychange', () => {
      for (const syncFn of visSyncers) {
        syncFn();
      }
    });
  }
}

type ToneName = 'navy' | 'blue' | 'teal' | 'amber' | 'orange' | 'crimson' | 'slate';

/** Semantic color modifier for live footer metric pills. */
export type MetricTone = '' | 'is-teal' | 'is-crimson' | 'is-blue';

interface PillItem<Id extends string = string> { readonly id: Id; readonly label: string; readonly active?: boolean }
interface SliderDef { readonly key: string; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly value: number; readonly fmt: (val: number) => string }
interface SubPanelDef { readonly title?: string; readonly titleKey?: string; readonly svgId?: string; readonly mountId?: string; readonly mountCls?: string }

type PanelDef =
  | { readonly kind: 'bridge'; readonly bridgeId: string; readonly bridgeText: string }
  | (SubPanelDef & { readonly kind: 'plot'; readonly cls?: string; readonly subpanels?: readonly SubPanelDef[] });

/** Declarative specification for an interactive figure card. */
export interface FigureSpec<M extends string = string> {
  readonly kicker: string;
  readonly modes?: ReadonlyArray<PillItem<M>>;
  readonly presets?: { readonly label: string; readonly items: readonly PillItem[] };
  readonly toggles?: ReadonlyArray<{ readonly key: string; readonly label: string; readonly on?: boolean }>;
  readonly actions?: ReadonlyArray<'step' | 'play'>;
  readonly stepLabel?: string;
  readonly stepMs?: number;
  readonly legend: ReadonlyArray<{ readonly kind: 'line' | 'dot' | 'swatch' | 'band'; readonly tone: ToneName; readonly dashed?: boolean; readonly label: string }>;
  readonly grid: 'is-2col' | 'is-2col-asym' | 'is-3col' | 'is-bridged';
  readonly panels: readonly PanelDef[];
  readonly sliders?: readonly SliderDef[];
  readonly radios?: ReadonlyArray<{ readonly key: string; readonly label: string; readonly value: string; readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }> }>;
  readonly metrics: ReadonlyArray<{ readonly key: string; readonly label: string }>;
}

/** Runtime handle passed to a figure's `setup` callback. */
export interface MountHandle<M extends string = string> {
  readonly mode: () => M;
  readonly flag: (key: string) => boolean;
  readonly num: (key: string) => number;
  readonly radio: (key: string) => string;
  readonly svg: (id: string) => SVGSVGElement;
  readonly el: (id: string) => HTMLElement;
  readonly isPlaying: () => boolean;
  readonly setMetric: (key: string, text: string, tone?: MetricTone) => void;
  readonly setTitle: (key: string, text: string) => void;
  readonly setSlider: (key: string, val: number) => void;
  readonly setMode: (mode: M) => void;
  readonly setPreset: (id: string | null) => void;
}

/** Lifecycle callbacks returned by a figure's `setup` function. */
export interface FigureHooks {
  readonly render: () => void;
  readonly step?: () => void;
  readonly onCtrl?: (key: string) => void;
  readonly onPreset?: (id: string) => void;
}

interface FigureStore {
  curMode: string;
  playBtn: HTMLButtonElement | null;
  hooks: FigureHooks | null;
  readonly flags: Map<string, boolean>;
  readonly nums: Map<string, number>;
  readonly radios: Map<string, string>;
  readonly svgs: Map<string, SVGSVGElement>;
  readonly els: Map<string, HTMLElement>;
  readonly metrics: Map<string, { readonly val: HTMLElement; readonly wrap: HTMLElement }>;
  readonly sliders: Map<string, { readonly input: HTMLInputElement; readonly output: HTMLElement; readonly def: SliderDef }>;
  readonly modeBtns: Map<string, HTMLButtonElement>;
  readonly presetBtns: Map<string, HTMLButtonElement>;
  readonly togglePlay: () => void;
}

function syncPressedMap(btns: ReadonlyMap<string, HTMLButtonElement>, activeId: string | null): void {
  for (const [id, btn] of btns) {
    patchAttrs(btn, { 'aria-pressed': String(id === activeId) });
  }
}

function fireStoreCtrl(store: FigureStore, key: string): void {
  store.hooks?.onCtrl?.(key);
  store.hooks?.render();
}

function buildPillGroup(label: string, items: readonly PillItem[], btnMap: Map<string, HTMLButtonElement>, onPick: (id: string) => void): HTMLElement {
  const activeIdx = Math.max(0, items.findIndex((item) => item.active));
  const btns = items.map((item, idx) => {
    const btn = h('button', { type: 'button', 'aria-pressed': String(idx === activeIdx), onClick: () => {
      onPick(item.id);
    } }, item.label);
    btnMap.set(item.id, btn);
    return btn;
  });
  return h('div', { cls: 'pill-group', role: 'group', 'aria-label': label }, ...btns);
}

function buildActionBtns(spec: FigureSpec, store: FigureStore, initialPlaying: boolean): HTMLElement[] {
  const btns: HTMLElement[] = (spec.toggles ?? []).map((toggle) => {
    const initOn = toggle.on ?? true;
    store.flags.set(toggle.key, initOn);
    const btn = h('button', { type: 'button', 'aria-pressed': String(initOn), onClick: () => {
      const next = !(store.flags.get(toggle.key) ?? false);
      store.flags.set(toggle.key, next);
      patchAttrs(btn, { 'aria-pressed': String(next) });
      setText(btn, `${toggle.label}: ${next ? 'ON' : 'OFF'}`);
      fireStoreCtrl(store, toggle.key);
    } }, `${toggle.label}: ${initOn ? 'ON' : 'OFF'}`);
    return btn;
  });
  for (const action of spec.actions ?? []) {
    if (action === 'step') {
      btns.push(h('button', { type: 'button', onClick: () => {
        store.hooks?.step?.();
        store.hooks?.render();
      } }, spec.stepLabel ?? 'Step'));
      continue;
    }
    store.playBtn = h('button', { type: 'button', 'data-playing': String(initialPlaying), onClick: store.togglePlay }, initialPlaying ? 'Pause' : 'Play');
    btns.push(store.playBtn);
  }
  return btns;
}

function buildHeader(spec: FigureSpec, store: FigureStore, initialPlaying: boolean): HTMLElement {
  const groups: HTMLElement[] = [];
  if (spec.modes?.length) {
    store.curMode = (spec.modes.find((m) => m.active) ?? spec.modes[0]).id;
    groups.push(buildPillGroup('Mode', spec.modes, store.modeBtns, (id) => {
      store.curMode = id;
      syncPressedMap(store.modeBtns, id);
      fireStoreCtrl(store, 'mode');
    }));
  }
  if (spec.presets) {
    groups.push(buildPillGroup(spec.presets.label, spec.presets.items, store.presetBtns, (id) => {
      syncPressedMap(store.presetBtns, id);
      store.hooks?.onPreset?.(id);
      store.hooks?.render();
    }));
  }
  const actions = buildActionBtns(spec, store, initialPlaying);
  if (actions.length) {
    groups.push(h('div', { cls: 'vh-actions' }, ...actions));
  }
  return h('div', { cls: 'vh' }, h('div', { cls: 'vh-kicker' }, spec.kicker), groups.length ? h('div', { cls: 'vh-controls' }, ...groups) : null);
}

function buildSlotNodes(slot: SubPanelDef, store: FigureStore): DomChild[] {
  const out: DomChild[] = [];
  if (slot.title) {
    const titleEl = h('div', { cls: 'viz-panel-title' }, slot.title);
    if (slot.titleKey) {
      store.els.set(slot.titleKey, titleEl);
    }
    out.push(titleEl);
  }
  if (slot.svgId) {
    const svg = svgEl('svg', { id: slot.svgId, cls: 'viz-svg' });
    store.svgs.set(slot.svgId, svg);
    out.push(svg);
  }
  if (slot.mountId) {
    const mountDiv = h('div', { id: slot.mountId, cls: slot.mountCls });
    store.els.set(slot.mountId, mountDiv);
    out.push(mountDiv);
  }
  return out;
}

function buildPanelNode(panel: PanelDef, store: FigureStore): HTMLElement {
  if (panel.kind === 'bridge') {
    const bridge = h('span', { id: panel.bridgeId, cls: 'viz-bridge-pill' }, panel.bridgeText);
    store.els.set(panel.bridgeId, bridge);
    return bridge;
  }
  if (panel.kind === 'plot') {
    const subs = (panel.subpanels ?? []).map((sub) => h('div', null, ...buildSlotNodes(sub, store)));
    return h('div', { cls: `viz-panel${panel.cls ? ` ${panel.cls}` : ''}` }, ...buildSlotNodes(panel, store), ...subs);
  }
  return assertNever(panel);
}

function buildSliderRow(slider: SliderDef, store: FigureStore): HTMLElement {
  store.nums.set(slider.key, slider.value);
  const initText = slider.fmt(slider.value);
  const output = h('span', { cls: 'ctrl-val', 'aria-hidden': 'true' }, initText);
  const input = h('input', {
    type: 'range', 'aria-label': slider.label, 'aria-valuetext': initText, min: slider.min, max: slider.max, step: slider.step, value: slider.value,
    onInput: () => {
      const parsed = Number(input.value);
      if (Number.isFinite(parsed)) {
        const txt = slider.fmt(parsed);
        store.nums.set(slider.key, parsed);
        patchAttrs(input, { 'aria-valuetext': txt });
        setText(output, txt);
        fireStoreCtrl(store, slider.key);
      }
    },
  });
  store.sliders.set(slider.key, { input, output, def: slider });
  return h('label', { cls: 'ctrl-row' }, h('span', { cls: 'ctrl-label' }, slider.label), input, output);
}

function buildRadioRow(figId: string, radio: NonNullable<FigureSpec['radios']>[number], store: FigureStore): HTMLElement {
  store.radios.set(radio.key, radio.value);
  const opts = radio.options.map((opt) => {
    const inp = h('input', {
      type: 'radio', name: `${figId}-${radio.key}`, value: opt.value, checked: opt.value === radio.value,
      onChange: () => {
        if (inp.checked) {
          store.radios.set(radio.key, opt.value);
          fireStoreCtrl(store, radio.key);
        }
      },
    });
    return h('label', { cls: 'radio' }, inp, ' ', opt.label);
  });
  return h('div', { cls: 'ctrl-row ctrl-radio-row', role: 'radiogroup', 'aria-label': radio.label }, h('span', { cls: 'ctrl-label' }, radio.label), h('div', { cls: 'radios' }, ...opts));
}

function assembleFigureDom(id: string, spec: FigureSpec, store: FigureStore, initialPlaying: boolean): DocumentFragment {
  const frag = document.createDocumentFragment();
  const legend = h('div', { cls: 'viz-legend' }, ...spec.legend.map((item) => {
    const cls = item.kind === 'line' ? `leg-line is-${item.tone}${item.dashed ? ' is-dashed' : ''}` : `leg-swatch is-${item.kind} is-${item.tone}`;
    return h('span', { cls: 'leg-item' }, h('span', { 'aria-hidden': 'true', cls }), ...richNodes(item.label));
  }));
  const stage = h('div', { cls: 'viz-stage' }, h('div', { cls: `viz-panels ${spec.grid}` }, ...spec.panels.map((p) => buildPanelNode(p, store))));
  frag.append(buildHeader(spec, store, initialPlaying), legend, stage);
  const rows = [...(spec.sliders ?? []).map((s) => buildSliderRow(s, store)), ...(spec.radios ?? []).map((r) => buildRadioRow(id, r, store))];
  if (rows.length) {
    frag.append(h('div', { cls: 'fx-sliders' }, ...rows));
  }
  frag.append(h('div', { cls: 'fx-metrics' }, ...spec.metrics.map((metric) => {
    const val = h('strong', null);
    const wrap = h('span', { cls: 'm-kv' }, `${metric.label}: `, val);
    store.metrics.set(metric.key, { val, wrap });
    return wrap;
  })));
  return frag;
}

function setStoreSlider(store: FigureStore, key: string, val: number): void {
  const entry = store.sliders.get(key);
  if (!entry) {
    return;
  }
  const decimals = (String(entry.def.step).split('.')[1] ?? '').length;
  const snapped = Number(clamp(Math.round((val - entry.def.min) / entry.def.step) * entry.def.step + entry.def.min, entry.def.min, entry.def.max).toFixed(decimals));
  if (Number.isFinite(snapped)) {
    const txt = entry.def.fmt(snapped);
    store.nums.set(key, snapped);
    entry.input.value = String(snapped);
    patchAttrs(entry.input, { 'aria-valuetext': txt });
    setText(entry.output, txt);
  }
}

function setStoreMetric(store: FigureStore, key: string, text: string, tone: MetricTone = ''): void {
  const entry = store.metrics.get(key);
  if (entry) {
    setText(entry.val, text);
    patchAttrs(entry.wrap, { cls: tone ? `m-kv ${tone}` : 'm-kv' });
  }
}

function requireNode<T>(map: ReadonlyMap<string, T>, id: string): T {
  const node = map.get(id);
  if (!node) {
    throw new Error(`Missing node #${id}`);
  }
  return node;
}

function createFigureStore(togglePlay: () => void): FigureStore {
  return {
    curMode: '', playBtn: null, hooks: null,
    flags: new Map(), nums: new Map(), radios: new Map(), svgs: new Map(), els: new Map(),
    metrics: new Map(), sliders: new Map(), modeBtns: new Map(), presetBtns: new Map(), togglePlay,
  };
}

function createMountHandle(store: FigureStore, isPlaying: () => boolean): MountHandle {
  return {
    mode: () => store.curMode, flag: (key) => store.flags.get(key) ?? false, num: (key) => store.nums.get(key) ?? 0, radio: (key) => store.radios.get(key) ?? '',
    svg: (id) => requireNode(store.svgs, id), el: (id) => requireNode(store.els, id), isPlaying,
    setMetric(key, text, tone) {
      setStoreMetric(store, key, text, tone);
    },
    setTitle(key, text) {
      setText(store.els.get(key), text);
    },
    setSlider(key, val) {
      setStoreSlider(store, key, val);
    },
    setMode(mode) {
      store.curMode = mode;
      syncPressedMap(store.modeBtns, mode);
    },
    setPreset(id) {
      syncPressedMap(store.presetBtns, id);
    },
  };
}

interface PlayJob {
  readonly id: string;
  readonly rootEl: HTMLElement;
  readonly stepMs: number | undefined;
  readonly getStore: () => FigureStore;
  playing: boolean;
  inView: boolean;
  timerId: number | null;
}

function startPlayTimer(job: PlayJob, stepMs: number): void {
  job.timerId ??= window.setInterval(() => {
    const store = job.getStore();
    try {
      store.hooks?.step?.();
      store.hooks?.render();
    } catch (err: unknown) {
      console.error(`[viz:${job.id}]`, err);
      job.playing = false;
      syncPlaybackDom(job);
    }
  }, stepMs);
}

function syncPlaybackDom(job: PlayJob): void {
  const store = job.getStore();
  const active = job.playing && job.inView && !document.hidden;
  job.rootEl.classList.toggle('is-paused', !active);
  setText(store.playBtn, job.playing ? 'Pause' : 'Play');
  if (store.playBtn) {
    patchAttrs(store.playBtn, { 'data-playing': String(job.playing) });
  }
  if (!active || !store.hooks?.step || !job.stepMs) {
    if (job.timerId !== null) {
      window.clearInterval(job.timerId);
      job.timerId = null;
    }
    return;
  }
  startPlayTimer(job, job.stepMs);
}

function createPlaybackCtrl(id: string, rootEl: HTMLElement, stepMs: number | undefined, getStore: () => FigureStore): {
  readonly isPlaying: () => boolean; readonly toggle: () => void; readonly setInView: (visible: boolean) => void; readonly sync: () => void;
} {
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const job: PlayJob = { id, rootEl, stepMs, getStore, playing: !mq?.matches, inView: typeof IntersectionObserver === 'undefined', timerId: null };
  function sync(): void {
    syncPlaybackDom(job);
  }
  mq?.addEventListener('change', (evt: MediaQueryListEvent) => {
    if (evt.matches && job.playing) {
      job.playing = false;
      sync();
    }
  });
  return {
    isPlaying: () => job.playing,
    toggle() {
      job.playing = !job.playing;
      sync();
    },
    setInView(visible) {
      job.inView = visible;
      sync();
    },
    sync,
  };
}

/** Mounts an interactive figure into `#fig-${id} .viz-mount` with typed mode inference. */
export function mountFigure<M extends string = string>(id: string, spec: FigureSpec<M>, setup: (ctx: MountHandle<M>) => FigureHooks): void;
/** Mounts an interactive figure into `#fig-${id} .viz-mount` with error isolation and visibility gating. */
export function mountFigure(id: string, spec: FigureSpec, setup: (ctx: MountHandle) => FigureHooks): void {
  const rootEl = document.getElementById(`fig-${id}`);
  const mount = rootEl?.querySelector<HTMLElement>(ENGINE_CFG.mountSel);
  if (!rootEl || !mount) {
    return;
  }
  try {
    bindGlobalTooltip();
    const playback = createPlaybackCtrl(id, rootEl, spec.stepMs, () => store);
    const store = createFigureStore(playback.toggle);
    mount.replaceChildren(assembleFigureDom(id, spec, store, playback.isPlaying()));
    store.hooks = setup(createMountHandle(store, playback.isPlaying));
    store.hooks.render();
    observeVisibility(rootEl, playback.setInView, playback.sync);
    playback.sync();
  } catch (err: unknown) {
    console.error(`[viz:${id}]`, err);
    mount.replaceChildren(h('div', { cls: 'viz-card viz-note' }, 'Interactive figure unavailable.'));
  }
}
