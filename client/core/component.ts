import { parseArgs } from './element.ts'
import { getScope } from './scope.ts'
import { registerMountCallback } from './renderer/mount.ts'
import type { Child, ComponentFn, ComponentVNode } from './vnode.ts'

/**
 * The callable shape of a component factory. Like `ElementFn`, but
 * returns a ComponentVNode and accepts a `children` prop in addition
 * to variadic children at the call site.
 */
export interface ComponentFactory<P extends object> {
	(): ComponentVNode
	(props: P, ...children: Child[]): ComponentVNode
	(...children: Child[]): ComponentVNode
}

/**
 * Wrap a component function so call sites produce a ComponentVNode.
 *
 * The component function:
 *   - Runs once at mount time, inside a scope owned by the parent
 *     mount.
 *   - Receives `props.children` populated from variadic call-site
 *     children (unless the props object explicitly set `children`).
 *   - Returns a Child — anything that can be mounted: VNode, string,
 *     signal, array, etc.
 *
 * Effects and signals created inside the component body are owned by
 * the component's scope. When the component unmounts, the scope
 * disposes, cleanups fire.
 *
 * Usage:
 *   interface CardProps {
 *     title: string
 *     children?: Child[]
 *   }
 *
 *   const Card = defineComponent<CardProps>((props) =>
 *     div({ class: 'card' },
 *       h2(props.title),
 *       ...(props.children ?? []),
 *     )
 *   )
 *
 *   Card({ title: 'Hello' }, p('body content'))
 */
export function defineComponent<P extends object = object>(
	fn: ComponentFn<P & { children?: Child[] }>,
): ComponentFactory<P> {
	function component(...args: unknown[]): ComponentVNode {
		const { props, children } = parseArgs<P>(args)
		return {
			__vnode: true,
			kind: 'component',
			tag: fn as (props: Record<string, unknown>) => Child,
			props: props as Record<string, unknown>,
			children,
		}
	}
	return component as ComponentFactory<P>
}

/**
 * Register a callback to run after the component's DOM is mounted.
 * The callback fires once, in a microtask after the synchronous mount
 * completes, so the DOM is in the document by the time it runs.
 *
 * Returning a function from the callback registers it as a cleanup
 * to run when the component unmounts. Equivalent to React's useEffect
 * with an empty dependency array, or Solid's onMount.
 *
 * Usage:
 *   defineComponent(() => {
 *     onMount(() => {
 *       console.log('mounted')
 *       return () => console.log('unmounted')
 *     })
 *     return div('hello')
 *   })
 */
export function onMount(fn: () => void | (() => void)): void {
	const scope = getScope()
	if (!scope) {
		console.warn('[lolo-ui] onMount called outside a component scope; will not run.')
		return
	}
	registerMountCallback(scope, fn)
}

// Re-export onCleanup at the component-level name. Component authors
// import from `core/component.ts`; scope authors import from
// `core/scope.ts`. Same function, two doc contexts.
export { onCleanup } from './scope.ts'