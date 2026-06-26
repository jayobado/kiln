import type { Signal } from './signals.ts'
import type { ControlFlowNode } from './renderer/control-flow.ts'


/**
 * A value that can be reactive: a plain T, a Signal<T>, or a thunk
 * returning T. Used throughout the renderer for props and children that
 * may update over time.
 */
export type Reactive<T> = T | Signal<T> | (() => T)

/**
 * Anything that can appear as a child of an element or component.
 * Arrays flatten during mount. Primitives become text nodes. Signals
 * and thunks become reactive text bindings. VNodes recurse. Node
 * children (HTMLElement, Text, etc.) attach directly — this is the
 * interop point for the existing h()-based DSLs.
 */
export type Child =
	| string
	| number
	| boolean
	| null
	| undefined
	| VNode
	| Node
	| ControlFlowNode
	| Signal<Child>
	| (() => Child)
	| Child[]

/**
 * A component function: takes props, returns a child to mount.
 * Components run once at mount time inside their own scope; their
 * reactive bindings handle updates from then on.
 */
export type ComponentFn<P extends object = object> = (props: P) => Child

/**
 * An element VNode — produced by `el.*`, `svg.*`, and custom element
 * factories. The renderer creates a DOM element from the tag string.
 */
export interface ElementVNode {
	readonly __vnode: true
	readonly kind: 'element'
	readonly tag: string
	readonly props: Record<string, unknown>
	readonly children: Child[]
	readonly namespace?: 'svg' | 'mathml'
}

/**
 * A component VNode — produced by `defineComponent`. The renderer
 * invokes the function inside a scope and mounts whatever it returns.
 *
 * The internal `tag` type is loose (props as a plain record) because
 * the strongly-typed call site is at the wrapper produced by
 * `defineComponent`, which casts to this shape. The renderer never
 * needs to know the specific prop type.
 */
export interface ComponentVNode {
	readonly __vnode: true
	readonly kind: 'component'
	readonly tag: (props: Record<string, unknown>) => Child
	readonly props: Record<string, unknown>
	readonly children: Child[]
}

/**
 * Internal representation produced by element factories and
 * defineComponent wrappers. The renderer consumes a VNode once during
 * mount and discards it; VNodes are not retained or diffed.
 */
export type VNode = ElementVNode | ComponentVNode

/** Type guard: is this value a VNode? */
export function isVNode(x: unknown): x is VNode {
	return (
		x !== null &&
		typeof x === 'object' &&
		(x as { __vnode?: true }).__vnode === true
	)
}