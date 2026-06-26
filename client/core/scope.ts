import { effect as rawEffect } from './signals.ts'

type CleanupFn = () => void

export interface Scope {
	effect: (fn: () => void) => void
	onCleanup: (fn: CleanupFn) => void
	dispose: () => void
	readonly disposed: boolean
}

let activeScope: Scope | null = null

export function getScope(): Scope | null {
	return activeScope
}

export function resolveScope(explicit?: Scope): Scope | null {
	return explicit ?? activeScope
}

export interface Scope {
	effect: (fn: () => void) => void
	onCleanup: (fn: CleanupFn) => void
	dispose: () => void
	readonly disposed: boolean  // ← new
}

export function createScope(): Scope {
	const cleanups: CleanupFn[] = []
	let isDisposed = false

	const scope: Scope = {
		get disposed() {
			return isDisposed
		},
		effect(fn) {
			const dispose = rawEffect(fn)
			cleanups.push(dispose)
		},
		onCleanup(fn) {
			cleanups.push(fn)
		},
		dispose() {
			if (isDisposed) return
			isDisposed = true
			cleanups.forEach(fn => fn())
			cleanups.length = 0
		},
	}

	return scope
}

export function runInScope<T>(scope: Scope, fn: () => T): T {
	const prev = activeScope
	activeScope = scope
	try {
		return fn()
	} finally {
		activeScope = prev
	}
}

/**
 * Register a cleanup callback on the ambient scope. Convenience over
 * `getScope()?.onCleanup(fn)`. No-op with a warning if called outside
 * a scope, so accidental leaks surface in development.
 */
export function onCleanup(fn: CleanupFn): void {
	const scope = activeScope
	if (!scope) {
		console.warn('[lolo-ui] onCleanup called outside a scope; cleanup will not run.')
		return
	}
	scope.onCleanup(fn)
}