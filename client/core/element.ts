// core/element.ts

import { isVNode } from './vnode.ts'
import { isSignal } from './signals.ts'
import type { Child, ElementVNode } from './vnode.ts'

/**
 * Parse element/component args: optional props object followed by
 * variadic children. The first arg is treated as props only if it's
 * a plain object that's not a VNode, signal, array, function, or
 * DOM node.
 *
 * Examples (all valid):
 *   div()                          → no props, no children
 *   div({ class: 'x' })            → props only
 *   div('hello')                   → no props, one text child
 *   div('hello', 'world')          → no props, two children
 *   div({ class: 'x' }, 'hello')   → props + child
 */
export function parseArgs<P extends object>(
	args: unknown[],
): { props: P; children: Child[] } {
	if (args.length === 0) {
		return { props: {} as P, children: [] }
	}

	const first = args[0]
	if (isProps(first)) {
		return { props: first as P, children: args.slice(1) as Child[] }
	}

	return { props: {} as P, children: args as Child[] }
}

/**
 * Discriminate between a props object and a child value.
 *
 * Props are plain objects that aren't:
 *   - null or undefined
 *   - arrays (children list)
 *   - VNodes (children)
 *   - signals (reactive children)
 *   - functions (thunks or components)
 *   - DOM nodes (interop children from h()-based DSLs)
 *
 * A bare {} is treated as props (empty props object). Users who need
 * to pass an arbitrary object as a child should wrap it in a string
 * or VNode.
 */
function isProps(v: unknown): v is Record<string, unknown> {
	if (v === null || v === undefined) return false
	if (typeof v !== 'object') return false
	if (Array.isArray(v)) return false
	if (isVNode(v)) return false
	if (isSignal(v)) return false
	if (v instanceof Node) return false
	return true
}

/**
 * The callable shape of an element factory. Overloaded to support
 * all three call patterns: bare, props-only or props-with-children,
 * children-only.
 */
export interface ElementFn<P extends object> {
	(): ElementVNode
	(props: P, ...children: Child[]): ElementVNode
	(...children: Child[]): ElementVNode
}

/**
 * Create an element factory bound to a specific tag name. The factory
 * accepts any of the calling conventions handled by `parseArgs`.
 *
 * Used internally by the `el` and `svg` namespace objects, and
 * publicly via `customElement(tag)` for one-off custom tags.
 */
export function defineElement<P extends object>(
	tag: string,
	namespace?: 'svg' | 'mathml',
): ElementFn<P> {
	function element(...args: unknown[]): ElementVNode {
		const { props, children } = parseArgs<P>(args)
		const propsBag = props as Record<string, unknown>
		const vnode: ElementVNode = namespace
			? {
				__vnode: true,
				kind: 'element',
				tag,
				props: propsBag,
				children,
				namespace,
			}
			: {
				__vnode: true,
				kind: 'element',
				tag,
				props: propsBag,
				children,
			}
		return vnode
	}

	return element as ElementFn<P>
}