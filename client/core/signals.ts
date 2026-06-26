type Effect = () => void

let currentEffect: Effect | null = null
let batching = false
const pendingEffects = new Set<Effect>()

const effectSubscriptions = new WeakMap<Effect, Set<Set<Effect>>>()

export interface Signal<T> {
	get: () => T
	set: (value: T) => void
	update: (fn: (current: T) => T) => void
}

export function signal<T>(initialValue: T): Signal<T> {
	let value = initialValue
	const subscribers = new Set<Effect>()

	const get = (): T => {
		if (currentEffect) {
			subscribers.add(currentEffect)
			let subs = effectSubscriptions.get(currentEffect)
			if (!subs) {
				subs = new Set()
				effectSubscriptions.set(currentEffect, subs)
			}
			subs.add(subscribers)
		}
		return value
	}

	const set = (newValue: T): void => {
		if (Object.is(value, newValue)) return
		value = newValue
		if (batching) {
			subscribers.forEach(e => pendingEffects.add(e))
		} else {
			subscribers.forEach(e => e())
		}
	}

	const update = (fn: (current: T) => T): void => set(fn(value))

	return { get, set, update }
}

/**
 * Type guard: is this value a Signal? Structural check —
 * matches anything with the `get`, `set`, and `update` method shape.
 * Used by the renderer's `bind` to dispatch between reactive sources.
 */
export function isSignal<T = unknown>(x: unknown): x is Signal<T> {
	return (
		x !== null &&
		typeof x === 'object' &&
		typeof (x as { get?: unknown }).get === 'function' &&
		typeof (x as { set?: unknown }).set === 'function' &&
		typeof (x as { update?: unknown }).update === 'function'
	)
}

export function effect(fn: Effect): () => void {
	const execute = () => {
		const prevSubs = effectSubscriptions.get(execute)
		if (prevSubs) {
			prevSubs.forEach(subscriberSet => subscriberSet.delete(execute))
			prevSubs.clear()
		}

		currentEffect = execute
		try {
			fn()
		} finally {
			currentEffect = null
		}
	}
	execute()

	return () => {
		const subs = effectSubscriptions.get(execute)
		if (subs) {
			subs.forEach(subscriberSet => subscriberSet.delete(execute))
			subs.clear()
		}
		effectSubscriptions.delete(execute)
	}
}

export function computed<T>(fn: () => T): { get: () => T } {
	const s = signal<T>(undefined as unknown as T)
	effect(() => s.set(fn()))
	return { get: s.get }
}

export function batch(fn: () => void): void {
	batching = true
	try {
		fn()
	} finally {
		batching = false
		pendingEffects.forEach(e => e())
		pendingEffects.clear()
	}
}