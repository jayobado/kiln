import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

const FOCUSABLE = [
	'a[href]', 'button:not([disabled])', 'input:not([disabled])',
	'select:not([disabled])', 'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap(
	container: () => HTMLElement | null | undefined,
	scope?: Scope,
): () => void {
	const s = resolveScope(scope)
	let previousFocus: Element | null = null

	function getFocusable(): HTMLElement[] {
		const el = container()
		if (!el) return []
		return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key !== 'Tab') return
		const focusable = getFocusable()
		if (focusable.length === 0) return

		const first = focusable[0]
		const last = focusable[focusable.length - 1]

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault()
				last.focus()
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault()
				first.focus()
			}
		}
	}

	function activate(): void {
		previousFocus = document.activeElement
		document.addEventListener('keydown', onKeydown)
		const focusable = getFocusable()
		if (focusable.length) focusable[0].focus()
	}

	function deactivate(): void {
		document.removeEventListener('keydown', onKeydown)
		if (previousFocus instanceof HTMLElement) previousFocus.focus()
	}

	activate()

	const dispose = () => deactivate()
	s?.onCleanup(dispose)
	return dispose
}