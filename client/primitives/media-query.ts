import { signal } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export interface MediaQueryReturn {
	matches: { get: () => boolean }
	dispose: () => void
}

export function useMediaQuery(
	query: string,
	scope?: Scope,
): MediaQueryReturn {
	const s = resolveScope(scope)
	const mql = globalThis.matchMedia(query)
	const matches = signal(mql.matches)

	function onChange(e: MediaQueryListEvent): void {
		matches.set(e.matches)
	}

	mql.addEventListener('change', onChange)

	const dispose = () => {
		mql.removeEventListener('change', onChange)
	}

	s?.onCleanup(dispose)
	return { matches, dispose }
}