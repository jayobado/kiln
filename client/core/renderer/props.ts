import { onCleanup } from '../scope.ts'
import { bind } from './bind.ts'
import { NS } from './namespace.ts'
import type { Reactive } from '../vnode.ts'

/**
 * Apply a single prop to an element, setting up any reactive bindings.
 * The ambient scope owns any cleanups (event listeners, effects).
 */
export function applyProp(el: Element, key: string, value: unknown): void {
	// Renderer-internal — never touches the DOM
	if (key === 'key') return

	// ref callback — fires once with the element, no reactivity
	if (key === 'ref' && typeof value === 'function') {
		; (value as (el: Element) => void)(el)
		return
	}

	// Namespaced event: on:custom-name — for web component events and
	// any event name that doesn't fit the onCamelCase convention
	if (key.startsWith('on:')) {
		const eventName = key.slice(3)
		el.addEventListener(eventName, value as EventListener)
		onCleanup(() => el.removeEventListener(eventName, value as EventListener))
		return
	}

	// Standard onClick-style event handler
	if (isEventHandlerKey(key)) {
		const eventName = key.slice(2).toLowerCase()
		el.addEventListener(eventName, value as EventListener)
		onCleanup(() => el.removeEventListener(eventName, value as EventListener))
		return
	}

	// style — accepts string or Record<string, string>, reactively
	if (key === 'style') {
		bind(value as Reactive<string | Record<string, string> | null | undefined>, (v) => {
			if (typeof v === 'string') {
				el.setAttribute('style', v)
			} else if (v && typeof v === 'object') {
				const style = (el as HTMLElement).style
				for (const k in v) style.setProperty(k, v[k])
			} else {
				el.removeAttribute('style')
			}
		})
		return
	}

	// class — string, reactively
	if (key === 'class') {
		bind(value as Reactive<string | null | undefined | false>, (v) => {
			if (v) el.setAttribute('class', String(v))
			else el.removeAttribute('class')
		})
		return
	}

	// JS property assignment for known cases — `value` on inputs needs
	// property assignment, not setAttribute, because the attribute is
	// the *initial* value while the property is the current value.
	// SVG/MathML always use attributes — their JS properties are read-only
	// objects (e.g. SVGAnimatedRect for viewBox).
	if (el.namespaceURI === NS.HTML && shouldUseProperty(el, key)) {
		bind(value as Reactive<unknown>, (v) => {
			; (el as unknown as Record<string, unknown>)[key] = v
		})
		return
	}

	// Boolean attribute: presence/absence based on truthiness
	if (BOOLEAN_ATTRS.has(key)) {
		bind(value as Reactive<unknown>, (v) => {
			if (v) el.setAttribute(key, '')
			else el.removeAttribute(key)
		})
		return
	}

	// Default: setAttribute, stringifying. `null`, `undefined`, `false`
	// remove the attribute; everything else sets it.
	bind(value as Reactive<unknown>, (v) => {
		if (v == null || v === false) el.removeAttribute(key)
		else el.setAttribute(key, String(v))
	})
}

/**
 * Detect onCamelCase event handler keys: `on` + uppercase letter + rest.
 * Examples: onClick, onKeyDown, onMouseEnter.
 *
 * Excludes: `onclick` (no capital), `on` (too short), `only` (third
 * char is lowercase), `on:custom` (handled separately above).
 */
function isEventHandlerKey(key: string): boolean {
	if (key.length <= 2) return false
	if (!key.startsWith('on')) return false
	const third = key[2]
	return third >= 'A' && third <= 'Z'
}

/**
 * Native HTML keys to set as JS properties rather than attributes.
 * Limited to cases where the property is the source of truth.
 */
const NATIVE_PROPERTY_KEYS = new Set([
	'value',
	'checked',
	'selected',
	'innerHTML',
	'textContent',
])

function shouldUseProperty(el: Element, key: string): boolean {
	if (NATIVE_PROPERTY_KEYS.has(key)) return key in el
	// Custom elements (hyphenated tag) often expose props that aren't
	// reflected as attributes — Shoelace and similar. Use property if
	// one exists on the element.
	if (el.tagName.includes('-')) return key in el
	return false
}

/**
 * Boolean attributes per HTML spec: presence means true. The renderer
 * sets `attr=""` for truthy, removes for falsy. Setting `attr="false"`
 * would be wrong — the browser treats any present value as true.
 */
const BOOLEAN_ATTRS = new Set([
	'disabled',
	'hidden',
	'readonly',
	'required',
	'checked',
	'selected',
	'multiple',
	'autofocus',
	'autoplay',
	'controls',
	'loop',
	'muted',
	'open',
	'default',
	'defer',
	'async',
	'novalidate',
	'formnovalidate',
	'ismap',
	'playsinline',
	'reversed',
	'itemscope',
	'allowfullscreen',
])