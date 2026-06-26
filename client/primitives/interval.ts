import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export interface IntervalReturn {
	stop: () => void
	restart: () => void
}

export function useInterval(
	fn: () => void,
	delay: number,
	options?: { immediate?: boolean },
	scope?: Scope,
): IntervalReturn {
	const s = resolveScope(scope)
	let id: number | undefined

	function start(): void {
		stop()
		if (options?.immediate) fn()
		id = setInterval(fn, delay) as unknown as number
	}

	function stop(): void {
		if (id !== undefined) {
			clearInterval(id)
			id = undefined
		}
	}

	function restart(): void {
		start()
	}

	start()

	s?.onCleanup(stop)
	return { stop, restart }
}