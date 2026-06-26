import { isVNode } from '../vnode.ts'
import { isSignal } from '../signals.ts'
import { createScope, onCleanup, runInScope, type Scope } from '../scope.ts'
import { bind } from './bind.ts'
import { applyProp } from './props.ts'
import {
	createElementInNS,
	nextNamespace,
	NS,
	type Namespace,
} from './namespace.ts'
import type { Child, ComponentVNode, ElementVNode } from '../vnode.ts'
import { isControlFlowNode } from './control-flow.ts'

/**
 * Mount a VNode (or any Child) under `parent`, returning a disposer
 * that tears down the entire mounted subtree — disposes effects,
 * removes event listeners, removes DOM nodes.
 *
 * Establishes a root scope; all effects created during mount are
 * owned by this scope and dispose with it.
 *
 * Usage:
 *   const dispose = mount(el.div({}, 'hello'), document.body)
 *   // ...later:
 *   dispose()
 */
export function mount(child: Child, parent: Element): () => void {
	const scope = createScope()
	runInScope(scope, () => {
		mountChild(child, parent, null, [])
	})
	return () => scope.dispose()
}

/**
 * Internal: mount a single child under `parent`, optionally before
 * `anchor`. `captured` accumulates the DOM nodes this call creates,
 * so control-flow nodes can track and later remove/reorder them.
 *
 * Exported for use by control-flow nodes (when, each) and the
 * component-mount branch.
 */
export function mountChild(
	child: Child,
	parent: Element,
	anchor: Node | null,
	captured: Node[],
): void {
	// Arrays flatten
	if (Array.isArray(child)) {
		for (const c of child) mountChild(c, parent, anchor, captured)
		return
	}

	// null, undefined, boolean render nothing
	if (child === null || child === undefined || typeof child === 'boolean') {
		return
	}

	// Primitives → static text node
	if (typeof child === 'string' || typeof child === 'number') {
		const text = document.createTextNode(String(child))
		insertBefore(parent, text, anchor)
		captured.push(text)
		return
	}

	// Existing DOM node (interop with h()-based DSLs) — append directly.
	// If the node carries a __loloDispose function, register it for
	// cleanup when the surrounding scope disposes. This is the opt-in
	// convention for DSLs to participate in scope-based lifecycle.
	if (child instanceof Node) {
		insertBefore(parent, child, anchor)
		captured.push(child)

		const maybeDisposer = (child as { __loloDispose?: () => void }).__loloDispose
		if (typeof maybeDisposer === 'function') {
			onCleanup(maybeDisposer)
		}
		return
	}

	// Control-flow node (when, each) — owns its own mounting
	if (isControlFlowNode(child)) {
		child.mount(parent, anchor)
		return
	}


	// Element or component VNode
	if (isVNode(child)) {
		if (child.kind === 'element') {
			mountElement(child, parent, anchor, captured, currentNamespace())
		} else {
			mountComponent(child, parent, anchor, captured)
		}
		return
	}

	// Signal or thunk child → reactive text node
	if (isSignal(child) || typeof child === 'function') {
		const text = document.createTextNode('')
		insertBefore(parent, text, anchor)
		captured.push(text)
		bind(child as never, (v: unknown) => {
			text.nodeValue = renderTextValue(v as Child)
		})
		return
	}
}

/**
 * Mount an element VNode (kind === 'element'). Creates the DOM
 * element in the correct namespace, applies props, mounts children
 * with the (possibly switched) child namespace.
 */
function mountElement(
	node: ElementVNode,
	parent: Element,
	anchor: Node | null,
	captured: Node[],
	parentNs: Namespace,
): void {
	// Namespace can be hinted by svg.*/math.* factories, otherwise
	// inherited from the parent.
	const elNs: Namespace = node.namespace === 'svg'
		? NS.SVG
		: node.namespace === 'mathml'
			? NS.MATHML
			: parentNs

	const el = createElementInNS(node.tag, elNs)
	const childNs = nextNamespace(node.tag, elNs)

	// Apply props
	for (const key in node.props) {
		applyProp(el, key, node.props[key])
	}

	// Mount children, switching ambient namespace if needed
	withNamespace(childNs, () => {
		const innerCaptured: Node[] = []
		for (const c of node.children) {
			mountChild(c, el, null, innerCaptured)
		}
	})

	insertBefore(parent, el, anchor)
	captured.push(el)
}

/**
 * Mount a component VNode (kind === 'component'). Establishes a scope
 * owned by the parent mount, runs the component function once inside
 * that scope, mounts the returned Child, then flushes any registered
 * onMount callbacks via microtask.
 *
 * When the parent scope disposes, this component's scope disposes
 * with it (via the onCleanup hook), tearing down all effects and
 * event listeners the component created.
 */
function mountComponent(
	node: ComponentVNode,
	parent: Element,
	anchor: Node | null,
	captured: Node[],
): void {
	const fn = node.tag

	// Merge variadic children into props if the component didn't
	// explicitly provide a `children` prop in its props object.
	const props = node.children.length > 0 && !('children' in node.props)
		? { ...node.props, children: node.children }
		: node.props

	// Establish a scope owned by the current ambient scope.
	const scope = createScope()
	let returned: Child = null

	runInScope(scope, () => {
		returned = fn(props)
	})

	// Mount the returned child under the parent, still inside the
	// component's scope so any reactive children/props create effects
	// owned by the component.
	runInScope(scope, () => {
		mountChild(returned, parent, anchor, captured)
	})

	// Hook the component's scope into the current ambient scope so
	// the parent disposing cascades into us.
	onCleanup(() => scope.dispose())

	// Schedule any onMount callbacks the component registered.
	flushMountCallbacks(scope)
}

/**
 * Convert a reactive value to a string suitable for textContent.
 * null/undefined/boolean → empty string. Arrays and VNodes as direct
 * text children aren't supported — users should use when/each for
 * structural reactive children.
 */
function renderTextValue(v: Child): string {
	if (v === null || v === undefined || typeof v === 'boolean') return ''
	if (typeof v === 'string' || typeof v === 'number') return String(v)
	return ''
}

/**
 * Insert `node` into `parent` either before `anchor` or as the last
 * child. Anchor-aware insertion lets control-flow nodes mark stable
 * positions in dynamic regions.
 */
function insertBefore(parent: Element, node: Node, anchor: Node | null): void {
	if (anchor) parent.insertBefore(node, anchor)
	else parent.appendChild(node)
}

// ---------------- ambient namespace tracking ----------------
// Tracked via module-level state so element children inherit their
// parent's namespace without threading it through every call.

let ambientNs: Namespace = NS.HTML

function currentNamespace(): Namespace {
	return ambientNs
}

function withNamespace<T>(ns: Namespace, fn: () => T): T {
	const prev = ambientNs
	ambientNs = ns
	try {
		return fn()
	} finally {
		ambientNs = prev
	}
}

// ---------------- onMount registry ----------------
// Components register callbacks via onMount(); after the synchronous
// mount completes, callbacks fire in a microtask. Returning a cleanup
// function from the callback registers it on the component's scope.

type MountCallback = () => void | (() => void)

const MOUNT_CALLBACKS = new WeakMap<Scope, MountCallback[]>()

/**
 * Internal: register an onMount callback against a component's scope.
 * Called by `onMount` in `core/component.ts`.
 */
export function registerMountCallback(scope: Scope, fn: MountCallback): void {
	let list = MOUNT_CALLBACKS.get(scope)
	if (!list) {
		list = []
		MOUNT_CALLBACKS.set(scope, list)
	}
	list.push(fn)
}

/**
 * Flush registered onMount callbacks for a scope. Deferred via
 * microtask so the DOM is actually attached to the document by the
 * time callbacks fire.
 */
function flushMountCallbacks(scope: Scope): void {
	const list = MOUNT_CALLBACKS.get(scope)
	if (!list) return
	MOUNT_CALLBACKS.delete(scope)

	queueMicrotask(() => {
		for (const cb of list) {
			if (scope.disposed) return
			try {
				const cleanup = cb()
				if (typeof cleanup === 'function') {
					scope.onCleanup(cleanup)
				}
			} catch (e) {
				console.error('[lolo-ui] Error in onMount callback:', e)
			}
		}
	})
}