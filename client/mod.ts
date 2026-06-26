// mod.ts — public API for @jayobado/lolo-ui

// ─── Core: signals, scope, types ──────────────────────────────────────────
export * from './core/signals.ts'
export * from './core/scope.ts'

// ─── Existing: legacy DOM helpers (h, el, text, on, attr), router, app ───
// Kept as the lower-level escape hatch for imperative DOM construction.
// New code should prefer the variadic factories below.
export * from './core/dom.ts'
export * from './core/container.ts'
export * from './core/router.ts'
export * from './core/app.ts'

// ─── New: VNode types and authoring primitives ────────────────────────────
export type {
	Child,
	ComponentFn,
	ComponentVNode,
	ElementVNode,
	Reactive,
	VNode,
} from './core/vnode.ts'
export { isVNode } from './core/vnode.ts'

// ─── New: element and component factories ─────────────────────────────────
export { defineElement, parseArgs } from './core/element.ts'
export type { ElementFn } from './core/element.ts'

export { defineComponent, onCleanup, onMount } from './core/component.ts'
export type { ComponentFactory } from './core/component.ts'

// ─── New: renderer entry points ───────────────────────────────────────────
export { mount } from './core/renderer/mount.ts'
export { each, when, isControlFlowNode } from './core/renderer/control-flow.ts'
export type { ControlFlowNode } from './core/renderer/control-flow.ts'

// ─── New: typed element namespaces ────────────────────────────────────────
export { customElement, el } from './elements/html.ts'
export type { ElNamespace } from './elements/html.ts'
export { svg } from './elements/svg.ts'
export type { SvgNamespace } from './elements/svg.ts'

// ─── New: typed prop interfaces ───────────────────────────────────────────
// Re-exported so consumers can type their custom components with the same
// interfaces the built-in factories use.
export type {
	// Common
	ElementProps,
	EventHandler,
	GlobalAttrs,
	GlobalEvents,
	// HTML element props
	AnchorProps,
	AreaProps,
	AudioProps,
	BaseProps,
	BlockquoteProps,
	ButtonProps,
	CanvasProps,
	ColgroupProps,
	ColProps,
	DataProps,
	DetailsProps,
	DialogProps,
	EmbedProps,
	FieldsetProps,
	FormProps,
	IframeProps,
	ImgProps,
	InputProps,
	InsDelProps,
	LabelProps,
	LinkProps,
	MapProps,
	MetaProps,
	MeterProps,
	ObjectProps,
	OptgroupProps,
	OptionProps,
	OutputProps,
	ProgressProps,
	QuoteProps,
	ScriptProps,
	SelectProps,
	SourceProps,
	StyleProps,
	TableCellProps,
	TextareaProps,
	ThProps,
	TimeProps,
	TrackProps,
	VideoProps,
	// SVG props
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
	SvgGlobalAttrs,
	SvgImageProps,
	SvgRootProps,
	SvgTextProps,
	SymbolProps,
	TspanProps,
	UseProps,
} from './elements/dom-types.ts'