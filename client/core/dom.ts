type Child = Node | string | number | null | undefined | false

export interface BaseProps {
	class?: string
	id?: string
	role?: string
	title?: string
	tabIndex?: number
	key?: string | number
	'aria-label'?: string
	'aria-hidden'?: string
	'aria-expanded'?: string
	'aria-live'?: string
	onClick?: (e: MouseEvent) => void
	onDblclick?: (e: MouseEvent) => void
	onMouseenter?: (e: MouseEvent) => void
	onMouseleave?: (e: MouseEvent) => void
	onFocus?: (e: FocusEvent) => void
	onBlur?: (e: FocusEvent) => void
	onKeydown?: (e: KeyboardEvent) => void
	onKeyup?: (e: KeyboardEvent) => void
	onInput?: (e: InputEvent) => void
	onChange?: (e: Event) => void
	onSubmit?: (e: SubmitEvent) => void
	[attr: string]: unknown
}

export interface TagProps {
	input: BaseProps & {
		type?: string
		name?: string
		value?: string
		placeholder?: string
		disabled?: boolean
		required?: boolean
		readonly?: boolean
		checked?: boolean
		min?: string
		max?: string
		step?: string
		autocomplete?: string
		autofocus?: boolean
	}
	button: BaseProps & {
		type?: 'button' | 'submit' | 'reset'
		disabled?: boolean
	}
	a: BaseProps & {
		href?: string
		target?: string
		rel?: string
	}
	img: BaseProps & {
		src?: string
		alt?: string
		loading?: 'lazy' | 'eager'
		width?: number
		height?: number
	}
	form: BaseProps & {
		action?: string
		method?: string
		enctype?: string
	}
	label: BaseProps & {
		for?: string
	}
	select: BaseProps & {
		name?: string
		value?: string
		disabled?: boolean
		required?: boolean
		multiple?: boolean
	}
	option: BaseProps & {
		value?: string
		selected?: boolean
		disabled?: boolean
	}
	textarea: BaseProps & {
		name?: string
		value?: string
		placeholder?: string
		disabled?: boolean
		required?: boolean
		readonly?: boolean
		rows?: number
		cols?: number
	}
	th: BaseProps & {
		scope?: string
		colSpan?: number
		rowSpan?: number
	}
	td: BaseProps & {
		colSpan?: number
		rowSpan?: number
	}
}

type PropsFor<T extends string> = T extends keyof TagProps ? TagProps[T] : BaseProps

const eventMap: Record<string, string> = {
	onClick: 'click',
	onDblclick: 'dblclick',
	onMouseenter: 'mouseenter',
	onMouseleave: 'mouseleave',
	onFocus: 'focus',
	onBlur: 'blur',
	onKeydown: 'keydown',
	onKeyup: 'keyup',
	onInput: 'input',
	onChange: 'change',
	onSubmit: 'submit',
}

const booleanAttrs = new Set([
	'disabled', 
	'required', 
	'readonly', 
	'checked',
	'autofocus', 
	'multiple', 
	'selected',
])

const attrNameMap: Record<string, string> = {
	tabIndex: 'tabindex',
	colSpan: 'colspan',
	rowSpan: 'rowspan',
}

const skipAttrs = new Set([
	'class', 'key',
	...Object.keys(eventMap),
])

function applyProps(el: HTMLElement, props: BaseProps): void {
	if (props.class) el.className = props.class

	for (const [key, value] of Object.entries(props)) {
		if (value == null || skipAttrs.has(key)) continue

		if (key in eventMap) {
			el.addEventListener(eventMap[key], value as EventListener)
			continue
		}

		if (booleanAttrs.has(key)) {
			if (value) el.setAttribute(key, '')
			continue
		}

		const attrName = attrNameMap[key] ?? key
		el.setAttribute(attrName, String(value))
	}
}

function normaliseChildren(children: Child[]): (Node | string)[] {
	return (children.flat(Infinity as 1) as Child[])
		.filter(c => c != null && c !== false)
		.map(c => c instanceof Node ? c : String(c)) as (Node | string)[]
}

export function h<T extends string>(
	tag: T,
	props?: PropsFor<T> | null,
	...children: Child[]
): HTMLElement {
	const element = document.createElement(tag)
	if (props) applyProps(element, props as BaseProps)
	normaliseChildren(children).forEach(child => element.append(child))
	return element
}