/**
 * @fileoverview Ambient TypeScript declarations for Hugo-mounted D3 ESM modules.
 */

declare module 'd3-selection/select' {
  type ValueFn<D, R> = (datum: D, index: number) => R;

  /** Minimal typed D3 selection wrapper over DOM and SVG elements. */
  export interface Sel<E extends Element = SVGElement, D = unknown> {
    attr(name: string, value: string | number | null | ValueFn<D, string | number | null>): this;
    text(value: string | number | ValueFn<D, string | number>): this;
    append<K extends keyof SVGElementTagNameMap>(name: K): Sel<SVGElementTagNameMap[K], D>;
    selectAll<K extends Element = Element, ND = unknown>(selector: string): Sel<K, ND>;
    data<ND>(data: readonly ND[]): Sel<E, ND>;
    join(enter: string): Sel<E, D>;
    node(): E | null;
  }

  /** Wraps a DOM element or CSS selector in a typed D3 selection. */
  export default function select<E extends Element = Element, D = unknown>(node: E | string): Sel<E, D>;
}

declare module 'd3-shape/monotone' {
  /** Cubic spline interpolator preserving monotonicity in x. */
  export const monotoneX: (context: unknown) => unknown;
}

declare module 'd3-shape/line' {
  import type { monotoneX } from 'd3-shape/monotone';

  /** Configurable SVG path `d` generator for 2D polylines and curves. */
  export interface LineGen<D> {
    (data: readonly D[]): string | null;
    x(x: number | ((datum: D, index: number) => number)): this;
    y(y: number | ((datum: D, index: number) => number)): this;
    curve(curve: typeof monotoneX): this;
  }

  /** Creates a new D3 SVG line path generator. */
  export default function line<D = [number, number]>(): LineGen<D>;
}

declare module 'd3-shape/area' {
  import type { monotoneX } from 'd3-shape/monotone';

  interface AreaGen<D> {
    (data: readonly D[]): string | null;
    x(x: number | ((datum: D, index: number) => number)): this;
    y0(y: number | ((datum: D, index: number) => number)): this;
    y1(y: number | ((datum: D, index: number) => number)): this;
    curve(curve: typeof monotoneX): this;
  }

  /** Creates a new D3 SVG area path generator. */
  export default function area<D = [number, number]>(): AreaGen<D>;
}
