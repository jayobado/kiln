import { isSignal } from '../signals.ts'
import { getScope } from '../scope.ts'
import type { Signal } from '../signals.ts'
import type { Reactive } from '../vnode.ts'

/**
 * Run `apply` once with the current value, then again whenever the
 * source changes.
 *
 * - For a Signal<T>, registers an effect that re-applies when the
 *   signal changes. The effect is owned by the ambient scope.
 * - For a thunk (() => T), registers an effect that re-applies when
 *   any signal read inside the thunk changes.
 * - For a plain T, applies once. No reactivity, no cleanup.
 *
 * The ambient scope must be set before calling this for reactive
 * sources; the renderer establishes scopes at mount boundaries.
 */
export function bind<T>(source: Reactive<T>, apply: (value: T) => void): void {
	if (isSignal(source)) {
		const scope = getScope()
		if (!scope) {
			console.warn('[lolo-ui] bind() called outside a scope; reactive updates will leak.')
			apply((source as Signal<T>).get())
			return
		}
		scope.effect(() => apply((source as Signal<T>).get()))
		return
	}

	if (typeof source === 'function') {
		const scope = getScope()
		if (!scope) {
			console.warn('[lolo-ui] bind() called outside a scope; reactive updates will leak.')
			apply((source as () => T)())
			return
		}
		scope.effect(() => apply((source as () => T)()))
		return
	}

	// Plain value: apply once.
	apply(source as T)
}