import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export function useClickOutside(
	target: () => HTMLElement | null | undefined,
	handler: () => void,
	scope?: Scope,
): () => void {
	const s = resolveScope(scope)

	function onPointerDown(e: PointerEvent): void {
		const el = target()
		if (!el) return
		if (!el.contains(e.target as Node)) handler()
	}

	document.addEventListener('pointerdown', onPointerDown)

	const dispose = () => {
		document.removeEventListener('pointerdown', onPointerDown)
	}

	s?.onCleanup(dispose)
	return dispose
}