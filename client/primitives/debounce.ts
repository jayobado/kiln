import { signal, effect } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export interface DebounceValueReturn<T> {
	value: { get: () => T }
	dispose: () => void
}

export function useDebounce<T>(
	source: () => T,
	delay: number = 300,
	scope?: Scope,
): DebounceValueReturn<T> {
	const s = resolveScope(scope)
	const debounced = signal<T>(source())

	let timer: number | undefined

	const dispose = effect(() => {
		const current = source()
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			debounced.set(current)
		}, delay) as unknown as number
	})

	const cleanup = () => {
		if (timer) clearTimeout(timer)
		dispose()
	}

	s?.onCleanup(cleanup)
	return { value: debounced, dispose: cleanup }
}

export function useDebounceFn<TArgs extends unknown[]>(
	fn: (...args: TArgs) => void,
	delay: number = 300,
	scope?: Scope,
): { call: (...args: TArgs) => void; cancel: () => void; dispose: () => void } {
	const s = resolveScope(scope)
	let timer: number | undefined

	function call(...args: TArgs): void {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => fn(...args), delay) as unknown as number
	}

	function cancel(): void {
		if (timer) clearTimeout(timer)
		timer = undefined
	}

	s?.onCleanup(cancel)
	return { call, cancel, dispose: cancel }
}