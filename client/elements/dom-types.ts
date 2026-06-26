import type { Reactive } from '../core/vnode.ts'

export type EventHandler<E extends Event = Event> = (event: E) => void

/** Global attributes available on every HTML element. */
export interface GlobalAttrs {
	id?: Reactive<string>
	class?: Reactive<string | null | undefined | false>
	style?: Reactive<string | Record<string, string> | null | undefined>
	title?: Reactive<string>
	hidden?: Reactive<boolean>
	tabIndex?: Reactive<number>
	role?: Reactive<string>
	slot?: Reactive<string>
	key?: string | number
	ref?: (el: Element) => void
}

/** Common DOM events available on most elements. */
export interface GlobalEvents {
	onClick?: EventHandler<MouseEvent>
	onDblClick?: EventHandler<MouseEvent>
	onMouseDown?: EventHandler<MouseEvent>
	onMouseUp?: EventHandler<MouseEvent>
	onMouseEnter?: EventHandler<MouseEvent>
	onMouseLeave?: EventHandler<MouseEvent>
	onInput?: EventHandler<InputEvent>
	onChange?: EventHandler<Event>
	onFocus?: EventHandler<FocusEvent>
	onBlur?: EventHandler<FocusEvent>
	onKeyDown?: EventHandler<KeyboardEvent>
	onKeyUp?: EventHandler<KeyboardEvent>
	onKeyPress?: EventHandler<KeyboardEvent>
	onSubmit?: EventHandler<SubmitEvent>
}

/**
 * Base props for any HTML element. Includes global attrs, global
 * events, and catch-all index signatures for data-*, aria-*, and
 * on:custom-event keys.
 */
export type ElementProps = GlobalAttrs & GlobalEvents & {
	[key: `data-${string}`]: Reactive<string | number | boolean> | undefined
	[key: `aria-${string}`]: Reactive<string | number | boolean> | undefined
	[key: `on:${string}`]: EventHandler | undefined
}

/** Anchor (<a>) — adds href, target, rel, download. */
export interface AnchorProps extends ElementProps {
	href?: Reactive<string>
	target?: Reactive<'_self' | '_blank' | '_parent' | '_top'>
	rel?: Reactive<string>
	download?: Reactive<string | boolean>
}

/** Button — adds type, disabled, form association. */
export interface ButtonProps extends ElementProps {
	type?: Reactive<'submit' | 'button' | 'reset'>
	disabled?: Reactive<boolean>
	form?: Reactive<string>
	name?: Reactive<string>
	value?: Reactive<string>
}

/** Input — the type union covers common input types. */
export interface InputProps extends ElementProps {
	type?: Reactive<
		| 'text'
		| 'number'
		| 'email'
		| 'password'
		| 'checkbox'
		| 'radio'
		| 'file'
		| 'hidden'
		| 'date'
		| 'tel'
		| 'url'
		| 'search'
	>
	value ?: Reactive<string | number>
	checked ?: Reactive<boolean>
	placeholder ?: Reactive<string>
	disabled ?: Reactive<boolean>
	readonly ?: Reactive<boolean>
	required ?: Reactive<boolean>
	name ?: Reactive<string>
	min ?: Reactive<string | number>
	max ?: Reactive<string | number>
	step ?: Reactive<string | number>
	pattern ?: Reactive<string>
	autocomplete ?: Reactive<string>
}

export interface FormProps extends ElementProps {
	action?: Reactive<string>
	method?: Reactive<'get' | 'post'>
	enctype?: Reactive<
		| 'application/x-www-form-urlencoded'
		| 'multipart/form-data'
		| 'text/plain'
	>
	novalidate ?: Reactive<boolean>
}

export interface LabelProps extends ElementProps {
	for?: Reactive<string>
}

export interface ImgProps extends ElementProps {
	src?: Reactive<string>
	alt?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	loading?: Reactive<'lazy' | 'eager'>
}

// ─── SVG types ────────────────────────────────────────────────────────────

/**
 * Attributes shared across all SVG elements. SVG is XML, so attribute
 * names are case-sensitive — `viewBox` is correct, `viewbox` silently
 * fails to render. Hyphenated attributes like `stroke-width` use
 * string keys (no camelCase translation).
 */
export interface SvgGlobalAttrs {
	id?: Reactive<string>
	class?: Reactive<string | null | undefined | false>
	style?: Reactive<string | Record<string, string> | null | undefined>

	// Presentation attributes — work on most SVG elements via inheritance
	fill?: Reactive<string>
	'fill-opacity'?: Reactive<number | string>
	'fill-rule'?: Reactive<'nonzero' | 'evenodd' | 'inherit'>
	stroke?: Reactive<string>
	'stroke-width'?: Reactive<number | string>
	'stroke-opacity'?: Reactive<number | string>
	'stroke-linecap'?: Reactive<'butt' | 'round' | 'square'>
	'stroke-linejoin'?: Reactive<'miter' | 'round' | 'bevel'>
	'stroke-dasharray'?: Reactive<string>
	'stroke-dashoffset'?: Reactive<number | string>
	opacity?: Reactive<number | string>
	transform?: Reactive<string>
	'transform-origin'?: Reactive<string>
	'pointer-events'?: Reactive<string>
	visibility?: Reactive<'visible' | 'hidden' | 'collapse'>
	'clip-path'?: Reactive<string>
	mask?: Reactive<string>
	filter?: Reactive<string>

	ref?: (el: SVGElement) => void
	key?: string | number

	// Custom events on SVG elements (rare but legitimate for D3-style
	// integrations or web components)
	[key: `on:${string}`]: EventHandler | undefined
	[key: `data-${string}`]: Reactive<string | number | boolean> | undefined
	[key: `aria-${string}`]: Reactive<string | number | boolean> | undefined
}

/** Root <svg> element — adds viewport configuration. */
export interface SvgRootProps extends SvgGlobalAttrs, GlobalEvents {
	viewBox?: Reactive<string>
	preserveAspectRatio?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	xmlns?: Reactive<string>
}

/** Grouping element <g> — applies transforms and presentation to children. */
export interface GroupProps extends SvgGlobalAttrs, GlobalEvents { }

export interface CircleProps extends SvgGlobalAttrs, GlobalEvents {
	cx?: Reactive<number | string>
	cy?: Reactive<number | string>
	r?: Reactive<number | string>
}

export interface EllipseProps extends SvgGlobalAttrs, GlobalEvents {
	cx?: Reactive<number | string>
	cy?: Reactive<number | string>
	rx?: Reactive<number | string>
	ry?: Reactive<number | string>
}

export interface RectProps extends SvgGlobalAttrs, GlobalEvents {
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	rx?: Reactive<number | string>
	ry?: Reactive<number | string>
}

export interface LineProps extends SvgGlobalAttrs, GlobalEvents {
	x1?: Reactive<number | string>
	y1?: Reactive<number | string>
	x2?: Reactive<number | string>
	y2?: Reactive<number | string>
}

export interface PolylineProps extends SvgGlobalAttrs, GlobalEvents {
	points?: Reactive<string>
	'path-length'?: Reactive<number>
}

export interface PolygonProps extends SvgGlobalAttrs, GlobalEvents {
	points?: Reactive<string>
	'path-length'?: Reactive<number>
}

export interface PathProps extends SvgGlobalAttrs, GlobalEvents {
	d?: Reactive<string>
	'path-length'?: Reactive<number>
}

export interface SvgTextProps extends SvgGlobalAttrs, GlobalEvents {
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	dx?: Reactive<number | string>
	dy?: Reactive<number | string>
	'text-anchor'?: Reactive<'start' | 'middle' | 'end'>
	'dominant-baseline'?: Reactive<string>
	'font-family'?: Reactive<string>
	'font-size'?: Reactive<number | string>
	'font-weight'?: Reactive<string | number>
	'font-style'?: Reactive<'normal' | 'italic' | 'oblique'>
	'text-decoration'?: Reactive<string>
	'letter-spacing'?: Reactive<string>
	'word-spacing'?: Reactive<string>
	'lengthAdjust'?: Reactive<'spacing' | 'spacingAndGlyphs'>
	textLength?: Reactive<number | string>
}

export interface TspanProps extends SvgTextProps { }

export interface DefsProps extends SvgGlobalAttrs { }

export interface UseProps extends SvgGlobalAttrs, GlobalEvents {
	href?: Reactive<string>
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

export interface SymbolProps extends SvgGlobalAttrs {
	viewBox?: Reactive<string>
	preserveAspectRatio?: Reactive<string>
}

export interface SvgImageProps extends SvgGlobalAttrs, GlobalEvents {
	href?: Reactive<string>
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	preserveAspectRatio?: Reactive<string>
}

export interface ForeignObjectProps extends SvgGlobalAttrs, GlobalEvents {
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

/** Linear gradient definition — used inside <defs>. */
export interface LinearGradientProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	x1?: Reactive<number | string>
	y1?: Reactive<number | string>
	x2?: Reactive<number | string>
	y2?: Reactive<number | string>
	gradientUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	gradientTransform?: Reactive<string>
	spreadMethod?: Reactive<'pad' | 'reflect' | 'repeat'>
}

export interface RadialGradientProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	cx?: Reactive<number | string>
	cy?: Reactive<number | string>
	r?: Reactive<number | string>
	fx?: Reactive<number | string>
	fy?: Reactive<number | string>
	gradientUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	gradientTransform?: Reactive<string>
	spreadMethod?: Reactive<'pad' | 'reflect' | 'repeat'>
}

export interface StopProps extends SvgGlobalAttrs {
	offset?: Reactive<number | string>
	'stop-color'?: Reactive<string>
	'stop-opacity'?: Reactive<number | string>
}

export interface MarkerProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	markerWidth?: Reactive<number | string>
	markerHeight?: Reactive<number | string>
	refX?: Reactive<number | string>
	refY?: Reactive<number | string>
	orient?: Reactive<string>
	markerUnits?: Reactive<'userSpaceOnUse' | 'strokeWidth'>
	viewBox?: Reactive<string>
}

export interface ClipPathProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	clipPathUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
}

export interface MaskProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	maskUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	maskContentUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
}

export interface PatternProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	patternUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	patternContentUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	patternTransform?: Reactive<string>
	viewBox?: Reactive<string>
	preserveAspectRatio?: Reactive<string>
}

export interface FilterProps extends SvgGlobalAttrs {
	id?: Reactive<string>
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	filterUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
	primitiveUnits?: Reactive<'userSpaceOnUse' | 'objectBoundingBox'>
}

/**
 * Filter primitive base props. The full filter primitive set is large
 * and infrequently used; this base covers the common attributes.
 * Per-primitive interfaces can extend this in user code if specific
 * typing is needed.
 */
export interface FilterPrimitiveProps extends SvgGlobalAttrs {
	x?: Reactive<number | string>
	y?: Reactive<number | string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	result?: Reactive<string>
	in?: Reactive<string>
}

// ─── Additional HTML element prop types ───────────────────────────────────

export interface TextareaProps extends ElementProps {
	value?: Reactive<string>
	name?: Reactive<string>
	placeholder?: Reactive<string>
	disabled?: Reactive<boolean>
	readonly?: Reactive<boolean>
	required?: Reactive<boolean>
	rows?: Reactive<number>
	cols?: Reactive<number>
	maxlength?: Reactive<number>
	minlength?: Reactive<number>
	wrap?: Reactive<'hard' | 'soft' | 'off'>
	autocomplete?: Reactive<string>
	form?: Reactive<string>
}

export interface SelectProps extends ElementProps {
	value?: Reactive<string | number>
	name?: Reactive<string>
	disabled?: Reactive<boolean>
	required?: Reactive<boolean>
	multiple?: Reactive<boolean>
	size?: Reactive<number>
	autocomplete?: Reactive<string>
	form?: Reactive<string>
}

export interface OptionProps extends ElementProps {
	value?: Reactive<string | number>
	selected?: Reactive<boolean>
	disabled?: Reactive<boolean>
	label?: Reactive<string>
}

export interface OptgroupProps extends ElementProps {
	label?: Reactive<string>
	disabled?: Reactive<boolean>
}

export interface FieldsetProps extends ElementProps {
	name?: Reactive<string>
	disabled?: Reactive<boolean>
	form?: Reactive<string>
}

export interface OutputProps extends ElementProps {
	for?: Reactive<string>
	name?: Reactive<string>
	form?: Reactive<string>
}

export interface MeterProps extends ElementProps {
	value?: Reactive<number>
	min?: Reactive<number>
	max?: Reactive<number>
	low?: Reactive<number>
	high?: Reactive<number>
	optimum?: Reactive<number>
}

export interface ProgressProps extends ElementProps {
	value?: Reactive<number>
	max?: Reactive<number>
}

export interface VideoProps extends ElementProps {
	src?: Reactive<string>
	poster?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	controls?: Reactive<boolean>
	autoplay?: Reactive<boolean>
	loop?: Reactive<boolean>
	muted?: Reactive<boolean>
	playsinline?: Reactive<boolean>
	preload?: Reactive<'none' | 'metadata' | 'auto'>
	crossorigin?: Reactive<'anonymous' | 'use-credentials'>
}

export interface AudioProps extends ElementProps {
	src?: Reactive<string>
	controls?: Reactive<boolean>
	autoplay?: Reactive<boolean>
	loop?: Reactive<boolean>
	muted?: Reactive<boolean>
	preload?: Reactive<'none' | 'metadata' | 'auto'>
	crossorigin?: Reactive<'anonymous' | 'use-credentials'>
}

export interface SourceProps extends ElementProps {
	src?: Reactive<string>
	srcset?: Reactive<string>
	type?: Reactive<string>
	media?: Reactive<string>
	sizes?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

export interface TrackProps extends ElementProps {
	src?: Reactive<string>
	kind?: Reactive<'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata'>
	srclang?: Reactive<string>
	label?: Reactive<string>
	default?: Reactive<boolean>
}

export interface IframeProps extends ElementProps {
	src?: Reactive<string>
	srcdoc?: Reactive<string>
	name?: Reactive<string>
	sandbox?: Reactive<string>
	allow?: Reactive<string>
	allowfullscreen?: Reactive<boolean>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
	loading?: Reactive<'lazy' | 'eager'>
	referrerpolicy?: Reactive<string>
}

export interface CanvasProps extends ElementProps {
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

export interface DetailsProps extends ElementProps {
	open?: Reactive<boolean>
}

export interface DialogProps extends ElementProps {
	open?: Reactive<boolean>
}

export interface TimeProps extends ElementProps {
	datetime?: Reactive<string>
}

export interface DataProps extends ElementProps {
	value?: Reactive<string | number>
}

export interface BlockquoteProps extends ElementProps {
	cite?: Reactive<string>
}

export interface QuoteProps extends ElementProps {
	cite?: Reactive<string>
}

export interface InsDelProps extends ElementProps {
	cite?: Reactive<string>
	datetime?: Reactive<string>
}

export interface ColProps extends ElementProps {
	span?: Reactive<number>
}

export interface ColgroupProps extends ElementProps {
	span?: Reactive<number>
}

export interface TableCellProps extends ElementProps {
	colspan?: Reactive<number>
	rowspan?: Reactive<number>
	headers?: Reactive<string>
}

export interface ThProps extends TableCellProps {
	scope?: Reactive<'row' | 'col' | 'rowgroup' | 'colgroup'>
	abbr?: Reactive<string>
}

export interface ObjectProps extends ElementProps {
	data?: Reactive<string>
	type?: Reactive<string>
	name?: Reactive<string>
	form?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

export interface EmbedProps extends ElementProps {
	src?: Reactive<string>
	type?: Reactive<string>
	width?: Reactive<number | string>
	height?: Reactive<number | string>
}

export interface MapProps extends ElementProps {
	name?: Reactive<string>
}

export interface AreaProps extends ElementProps {
	alt?: Reactive<string>
	coords?: Reactive<string>
	shape?: Reactive<'rect' | 'circle' | 'poly' | 'default'>
	href?: Reactive<string>
	target?: Reactive<'_self' | '_blank' | '_parent' | '_top'>
	rel?: Reactive<string>
	download?: Reactive<string | boolean>
	referrerpolicy?: Reactive<string>
}

export interface LinkProps extends ElementProps {
	href?: Reactive<string>
	rel?: Reactive<string>
	type?: Reactive<string>
	media?: Reactive<string>
	sizes?: Reactive<string>
	crossorigin?: Reactive<'anonymous' | 'use-credentials'>
	as?: Reactive<string>
	disabled?: Reactive<boolean>
	integrity?: Reactive<string>
	referrerpolicy?: Reactive<string>
}

export interface MetaProps extends ElementProps {
	name?: Reactive<string>
	content?: Reactive<string>
	charset?: Reactive<string>
	'http-equiv'?: Reactive<string>
}

export interface BaseProps extends ElementProps {
	href?: Reactive<string>
	target?: Reactive<'_self' | '_blank' | '_parent' | '_top'>
}

export interface ScriptProps extends ElementProps {
	src?: Reactive<string>
	type?: Reactive<string>
	async?: Reactive<boolean>
	defer?: Reactive<boolean>
	crossorigin?: Reactive<'anonymous' | 'use-credentials'>
	integrity?: Reactive<string>
	nomodule?: Reactive<boolean>
	referrerpolicy?: Reactive<string>
}

export interface StyleProps extends ElementProps {
	type?: Reactive<string>
	media?: Reactive<string>
}