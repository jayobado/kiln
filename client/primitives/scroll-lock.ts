import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export function useScrollLock(
	scope?: Scope,
): () => void {
	const s = resolveScope(scope)
	const original = document.body.style.overflow

	document.body.style.overflow = 'hidden'

	const dispose = () => {
		document.body.style.overflow = original
	}

	s?.onCleanup(dispose)
	return dispose
}