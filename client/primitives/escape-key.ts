import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export function useEscapeKey(
	handler: () => void,
	scope?: Scope,
): () => void {
	const s = resolveScope(scope)

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') handler()
	}

	document.addEventListener('keydown', onKeydown)

	const dispose = () => {
		document.removeEventListener('keydown', onKeydown)
	}

	s?.onCleanup(dispose)
	return dispose
}