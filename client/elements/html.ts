import { defineElement } from '../core/element.ts'
import type { ElementFn } from '../core/element.ts'
import type {
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
	ElementProps,
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
} from './dom-types.ts'

/**
 * Type of the `el` namespace. Explicit so JSR's slow-types check can
 * resolve the public API without re-running inference at install time.
 */
export interface ElNamespace {
	// Sectioning and structure
	readonly div: ElementFn<ElementProps>
	readonly span: ElementFn<ElementProps>
	readonly section: ElementFn<ElementProps>
	readonly header: ElementFn<ElementProps>
	readonly footer: ElementFn<ElementProps>
	readonly main: ElementFn<ElementProps>
	readonly nav: ElementFn<ElementProps>
	readonly article: ElementFn<ElementProps>
	readonly aside: ElementFn<ElementProps>
	readonly address: ElementFn<ElementProps>
	readonly hgroup: ElementFn<ElementProps>
	readonly search: ElementFn<ElementProps>

	// Headings
	readonly h1: ElementFn<ElementProps>
	readonly h2: ElementFn<ElementProps>
	readonly h3: ElementFn<ElementProps>
	readonly h4: ElementFn<ElementProps>
	readonly h5: ElementFn<ElementProps>
	readonly h6: ElementFn<ElementProps>

	// Text content
	readonly p: ElementFn<ElementProps>
	readonly pre: ElementFn<ElementProps>
	readonly blockquote: ElementFn<BlockquoteProps>
	readonly q: ElementFn<QuoteProps>
	readonly cite: ElementFn<ElementProps>
	readonly hr: ElementFn<ElementProps>
	readonly br: ElementFn<ElementProps>
	readonly wbr: ElementFn<ElementProps>

	// Inline text semantics
	readonly a: ElementFn<AnchorProps>
	readonly strong: ElementFn<ElementProps>
	readonly em: ElementFn<ElementProps>
	readonly mark: ElementFn<ElementProps>
	readonly small: ElementFn<ElementProps>
	readonly sub: ElementFn<ElementProps>
	readonly sup: ElementFn<ElementProps>
	readonly abbr: ElementFn<ElementProps>
	readonly dfn: ElementFn<ElementProps>
	readonly i: ElementFn<ElementProps>
	readonly b: ElementFn<ElementProps>
	readonly u: ElementFn<ElementProps>
	readonly s: ElementFn<ElementProps>
	readonly kbd: ElementFn<ElementProps>
	readonly samp: ElementFn<ElementProps>
	readonly variable: ElementFn<ElementProps>
	readonly time: ElementFn<TimeProps>
	readonly data: ElementFn<DataProps>
	readonly code: ElementFn<ElementProps>
	readonly bdi: ElementFn<ElementProps>
	readonly bdo: ElementFn<ElementProps>
	readonly ruby: ElementFn<ElementProps>
	readonly rp: ElementFn<ElementProps>
	readonly rt: ElementFn<ElementProps>

	// Edits
	readonly ins: ElementFn<InsDelProps>
	readonly del: ElementFn<InsDelProps>

	// Embedded content
	readonly img: ElementFn<ImgProps>
	readonly picture: ElementFn<ElementProps>
	readonly video: ElementFn<VideoProps>
	readonly audio: ElementFn<AudioProps>
	readonly source: ElementFn<SourceProps>
	readonly track: ElementFn<TrackProps>
	readonly iframe: ElementFn<IframeProps>
	readonly embed: ElementFn<EmbedProps>
	readonly object: ElementFn<ObjectProps>
	readonly canvas: ElementFn<CanvasProps>
	readonly map: ElementFn<MapProps>
	readonly area: ElementFn<AreaProps>

	// Forms
	readonly form: ElementFn<FormProps>
	readonly fieldset: ElementFn<FieldsetProps>
	readonly legend: ElementFn<ElementProps>
	readonly label: ElementFn<LabelProps>
	readonly input: ElementFn<InputProps>
	readonly textarea: ElementFn<TextareaProps>
	readonly select: ElementFn<SelectProps>
	readonly option: ElementFn<OptionProps>
	readonly optgroup: ElementFn<OptgroupProps>
	readonly button: ElementFn<ButtonProps>
	readonly output: ElementFn<OutputProps>
	readonly meter: ElementFn<MeterProps>
	readonly progress: ElementFn<ProgressProps>
	readonly datalist: ElementFn<ElementProps>

	// Lists
	readonly ul: ElementFn<ElementProps>
	readonly ol: ElementFn<ElementProps>
	readonly li: ElementFn<ElementProps>
	readonly dl: ElementFn<ElementProps>
	readonly dt: ElementFn<ElementProps>
	readonly dd: ElementFn<ElementProps>
	readonly menu: ElementFn<ElementProps>

	// Tables
	readonly table: ElementFn<ElementProps>
	readonly thead: ElementFn<ElementProps>
	readonly tbody: ElementFn<ElementProps>
	readonly tfoot: ElementFn<ElementProps>
	readonly tr: ElementFn<ElementProps>
	readonly th: ElementFn<ThProps>
	readonly td: ElementFn<TableCellProps>
	readonly caption: ElementFn<ElementProps>
	readonly col: ElementFn<ColProps>
	readonly colgroup: ElementFn<ColgroupProps>

	// Interactive
	readonly details: ElementFn<DetailsProps>
	readonly summary: ElementFn<ElementProps>
	readonly dialog: ElementFn<DialogProps>

	// Code and templating
	readonly template: ElementFn<ElementProps>
	readonly slot: ElementFn<ElementProps>

	// Document metadata
	readonly link: ElementFn<LinkProps>
	readonly meta: ElementFn<MetaProps>
	readonly base: ElementFn<BaseProps>
	readonly script: ElementFn<ScriptProps>
	readonly noscript: ElementFn<ElementProps>
	readonly style: ElementFn<StyleProps>
	readonly title: ElementFn<ElementProps>
}

/**
 * The `el` namespace — every HTML element as a typed factory.
 *
 * (existing docstring continues...)
 */
export const el: ElNamespace = {
	// Sectioning and structure
	div: defineElement<ElementProps>('div'),
	span: defineElement<ElementProps>('span'),
	section: defineElement<ElementProps>('section'),
	header: defineElement<ElementProps>('header'),
	footer: defineElement<ElementProps>('footer'),
	main: defineElement<ElementProps>('main'),
	nav: defineElement<ElementProps>('nav'),
	article: defineElement<ElementProps>('article'),
	aside: defineElement<ElementProps>('aside'),
	address: defineElement<ElementProps>('address'),
	hgroup: defineElement<ElementProps>('hgroup'),
	search: defineElement<ElementProps>('search'),

	// Headings
	h1: defineElement<ElementProps>('h1'),
	h2: defineElement<ElementProps>('h2'),
	h3: defineElement<ElementProps>('h3'),
	h4: defineElement<ElementProps>('h4'),
	h5: defineElement<ElementProps>('h5'),
	h6: defineElement<ElementProps>('h6'),

	// Text content
	p: defineElement<ElementProps>('p'),
	pre: defineElement<ElementProps>('pre'),
	blockquote: defineElement<BlockquoteProps>('blockquote'),
	q: defineElement<QuoteProps>('q'),
	cite: defineElement<ElementProps>('cite'),
	hr: defineElement<ElementProps>('hr'),
	br: defineElement<ElementProps>('br'),
	wbr: defineElement<ElementProps>('wbr'),

	// Inline text semantics
	a: defineElement<AnchorProps>('a'),
	strong: defineElement<ElementProps>('strong'),
	em: defineElement<ElementProps>('em'),
	mark: defineElement<ElementProps>('mark'),
	small: defineElement<ElementProps>('small'),
	sub: defineElement<ElementProps>('sub'),
	sup: defineElement<ElementProps>('sup'),
	abbr: defineElement<ElementProps>('abbr'),
	dfn: defineElement<ElementProps>('dfn'),
	i: defineElement<ElementProps>('i'),
	b: defineElement<ElementProps>('b'),
	u: defineElement<ElementProps>('u'),
	s: defineElement<ElementProps>('s'),
	kbd: defineElement<ElementProps>('kbd'),
	samp: defineElement<ElementProps>('samp'),
	variable: defineElement<ElementProps>('var'),
	time: defineElement<TimeProps>('time'),
	data: defineElement<DataProps>('data'),
	code: defineElement<ElementProps>('code'),
	bdi: defineElement<ElementProps>('bdi'),
	bdo: defineElement<ElementProps>('bdo'),
	ruby: defineElement<ElementProps>('ruby'),
	rp: defineElement<ElementProps>('rp'),
	rt: defineElement<ElementProps>('rt'),

	// Edits
	ins: defineElement<InsDelProps>('ins'),
	del: defineElement<InsDelProps>('del'),

	// Embedded content
	img: defineElement<ImgProps>('img'),
	picture: defineElement<ElementProps>('picture'),
	video: defineElement<VideoProps>('video'),
	audio: defineElement<AudioProps>('audio'),
	source: defineElement<SourceProps>('source'),
	track: defineElement<TrackProps>('track'),
	iframe: defineElement<IframeProps>('iframe'),
	embed: defineElement<EmbedProps>('embed'),
	object: defineElement<ObjectProps>('object'),
	canvas: defineElement<CanvasProps>('canvas'),
	map: defineElement<MapProps>('map'),
	area: defineElement<AreaProps>('area'),

	// Forms
	form: defineElement<FormProps>('form'),
	fieldset: defineElement<FieldsetProps>('fieldset'),
	legend: defineElement<ElementProps>('legend'),
	label: defineElement<LabelProps>('label'),
	input: defineElement<InputProps>('input'),
	textarea: defineElement<TextareaProps>('textarea'),
	select: defineElement<SelectProps>('select'),
	option: defineElement<OptionProps>('option'),
	optgroup: defineElement<OptgroupProps>('optgroup'),
	button: defineElement<ButtonProps>('button'),
	output: defineElement<OutputProps>('output'),
	meter: defineElement<MeterProps>('meter'),
	progress: defineElement<ProgressProps>('progress'),
	datalist: defineElement<ElementProps>('datalist'),

	// Lists
	ul: defineElement<ElementProps>('ul'),
	ol: defineElement<ElementProps>('ol'),
	li: defineElement<ElementProps>('li'),
	dl: defineElement<ElementProps>('dl'),
	dt: defineElement<ElementProps>('dt'),
	dd: defineElement<ElementProps>('dd'),
	menu: defineElement<ElementProps>('menu'),

	// Tables
	table: defineElement<ElementProps>('table'),
	thead: defineElement<ElementProps>('thead'),
	tbody: defineElement<ElementProps>('tbody'),
	tfoot: defineElement<ElementProps>('tfoot'),
	tr: defineElement<ElementProps>('tr'),
	th: defineElement<ThProps>('th'),
	td: defineElement<TableCellProps>('td'),
	caption: defineElement<ElementProps>('caption'),
	col: defineElement<ColProps>('col'),
	colgroup: defineElement<ColgroupProps>('colgroup'),

	// Interactive
	details: defineElement<DetailsProps>('details'),
	summary: defineElement<ElementProps>('summary'),
	dialog: defineElement<DialogProps>('dialog'),

	// Code and templating
	template: defineElement<ElementProps>('template'),
	slot: defineElement<ElementProps>('slot'),

	// Document metadata
	link: defineElement<LinkProps>('link'),
	meta: defineElement<MetaProps>('meta'),
	base: defineElement<BaseProps>('base'),
	script: defineElement<ScriptProps>('script'),
	noscript: defineElement<ElementProps>('noscript'),
	style: defineElement<StyleProps>('style'),
	title: defineElement<ElementProps>('title'),
}

/**
 * Factory for custom (hyphenated) element tags. Use this for web
 * components and any HTML element not in the `el` namespace.
 */
export function customElement<P extends object = ElementProps>(
	tag: `${string}-${string}`,
): ElementFn<P> {
	return defineElement<P>(tag)
}