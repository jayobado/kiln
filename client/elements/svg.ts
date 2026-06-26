import { defineElement } from '../core/element.ts'
import type { ElementFn } from '../core/element.ts'
import type {
	CircleProps,
	ClipPathProps,
	DefsProps,
	EllipseProps,
	FilterPrimitiveProps,
	FilterProps,
	ForeignObjectProps,
	GroupProps,
	LineProps,
	LinearGradientProps,
	MarkerProps,
	MaskProps,
	PathProps,
	PatternProps,
	PolygonProps,
	PolylineProps,
	RadialGradientProps,
	RectProps,
	StopProps,
	SvgImageProps,
	SvgRootProps,
	SvgTextProps,
	SymbolProps,
	TspanProps,
	UseProps,
} from './dom-types.ts'

/**
 * Type of the `svg` namespace. Explicit for JSR's slow-types check.
 */
export interface SvgNamespace {
	// Root and structural
	readonly svg: ElementFn<SvgRootProps>
	readonly g: ElementFn<GroupProps>
	readonly defs: ElementFn<DefsProps>
	readonly symbol: ElementFn<SymbolProps>
	readonly use: ElementFn<UseProps>

	// Basic shapes
	readonly circle: ElementFn<CircleProps>
	readonly ellipse: ElementFn<EllipseProps>
	readonly rect: ElementFn<RectProps>
	readonly line: ElementFn<LineProps>
	readonly polyline: ElementFn<PolylineProps>
	readonly polygon: ElementFn<PolygonProps>
	readonly path: ElementFn<PathProps>

	// Text
	readonly text: ElementFn<SvgTextProps>
	readonly tspan: ElementFn<TspanProps>

	// Embedded
	readonly image: ElementFn<SvgImageProps>
	readonly foreignObject: ElementFn<ForeignObjectProps>

	// Gradients and patterns
	readonly linearGradient: ElementFn<LinearGradientProps>
	readonly radialGradient: ElementFn<RadialGradientProps>
	readonly stop: ElementFn<StopProps>
	readonly pattern: ElementFn<PatternProps>

	// Markers and clipping
	readonly marker: ElementFn<MarkerProps>
	readonly clipPath: ElementFn<ClipPathProps>
	readonly mask: ElementFn<MaskProps>

	// Filters
	readonly filter: ElementFn<FilterProps>
	readonly feGaussianBlur: ElementFn<FilterPrimitiveProps>
	readonly feOffset: ElementFn<FilterPrimitiveProps>
	readonly feBlend: ElementFn<FilterPrimitiveProps>
	readonly feFlood: ElementFn<FilterPrimitiveProps>
	readonly feMerge: ElementFn<FilterPrimitiveProps>
	readonly feMergeNode: ElementFn<FilterPrimitiveProps>
	readonly feColorMatrix: ElementFn<FilterPrimitiveProps>
	readonly feComposite: ElementFn<FilterPrimitiveProps>
}

/**
 * The `svg` namespace — every SVG element as a typed factory.
 *
 * (existing docstring continues...)
 */
export const svg: SvgNamespace = {
	// Root and structural
	svg: defineElement<SvgRootProps>('svg', 'svg'),
	g: defineElement<GroupProps>('g', 'svg'),
	defs: defineElement<DefsProps>('defs', 'svg'),
	symbol: defineElement<SymbolProps>('symbol', 'svg'),
	use: defineElement<UseProps>('use', 'svg'),

	// Basic shapes
	circle: defineElement<CircleProps>('circle', 'svg'),
	ellipse: defineElement<EllipseProps>('ellipse', 'svg'),
	rect: defineElement<RectProps>('rect', 'svg'),
	line: defineElement<LineProps>('line', 'svg'),
	polyline: defineElement<PolylineProps>('polyline', 'svg'),
	polygon: defineElement<PolygonProps>('polygon', 'svg'),
	path: defineElement<PathProps>('path', 'svg'),

	// Text
	text: defineElement<SvgTextProps>('text', 'svg'),
	tspan: defineElement<TspanProps>('tspan', 'svg'),

	// Embedded
	image: defineElement<SvgImageProps>('image', 'svg'),
	foreignObject: defineElement<ForeignObjectProps>('foreignObject', 'svg'),

	// Gradients and patterns
	linearGradient: defineElement<LinearGradientProps>('linearGradient', 'svg'),
	radialGradient: defineElement<RadialGradientProps>('radialGradient', 'svg'),
	stop: defineElement<StopProps>('stop', 'svg'),
	pattern: defineElement<PatternProps>('pattern', 'svg'),

	// Markers and clipping
	marker: defineElement<MarkerProps>('marker', 'svg'),
	clipPath: defineElement<ClipPathProps>('clipPath', 'svg'),
	mask: defineElement<MaskProps>('mask', 'svg'),

	// Filters
	filter: defineElement<FilterProps>('filter', 'svg'),
	feGaussianBlur: defineElement<FilterPrimitiveProps>('feGaussianBlur', 'svg'),
	feOffset: defineElement<FilterPrimitiveProps>('feOffset', 'svg'),
	feBlend: defineElement<FilterPrimitiveProps>('feBlend', 'svg'),
	feFlood: defineElement<FilterPrimitiveProps>('feFlood', 'svg'),
	feMerge: defineElement<FilterPrimitiveProps>('feMerge', 'svg'),
	feMergeNode: defineElement<FilterPrimitiveProps>('feMergeNode', 'svg'),
	feColorMatrix: defineElement<FilterPrimitiveProps>('feColorMatrix', 'svg'),
	feComposite: defineElement<FilterPrimitiveProps>('feComposite', 'svg'),
}