import { signal } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'
import { createPortal } from '../primitives/portal.ts'
import { useEscapeKey } from '../primitives/escape-key.ts'
import { useFocusTrap } from '../primitives/focus-trap.ts'
import { useScrollLock } from '../primitives/scroll-lock.ts'

export interface ModalOptions {
	class?: string
	backdropClass?: string
	closeOnBackdrop?: boolean
	closeOnEscape?: boolean
	trapFocus?: boolean
	lockScroll?: boolean
	onOpen?: () => void
	onClose?: () => void
}

export interface ModalReturn {
	open: () => void
	close: () => void
	isOpen: { get: () => boolean }
	dispose: () => void
}

export function useModal(
	content: () => HTMLElement,
	options?: ModalOptions,
	scope?: Scope,
): ModalReturn {
	const s = resolveScope(scope)
	const opts = options ?? {}
	const isOpen = signal(false)

	let portal: { element: HTMLElement; remove: () => void } | null = null
	let backdrop: HTMLElement | null = null
	let cleanups: Array<() => void> = []

	function open(): void {
		if (isOpen.get()) return
		isOpen.set(true)

		backdrop = document.createElement('div')
		if (opts.backdropClass) backdrop.className = opts.backdropClass

		if (opts.closeOnBackdrop !== false) {
			backdrop.addEventListener('pointerdown', (e) => {
				if (e.target === backdrop) close()
			})
		}

		const wrapper = document.createElement('div')
		wrapper.setAttribute('role', 'dialog')
		wrapper.setAttribute('aria-modal', 'true')
		if (opts.class) wrapper.className = opts.class

		wrapper.appendChild(content())
		backdrop.appendChild(wrapper)

		portal = createPortal(backdrop)

		if (opts.closeOnEscape !== false) {
			cleanups.push(useEscapeKey(close))
		}

		if (opts.trapFocus !== false) {
			cleanups.push(useFocusTrap(() => wrapper))
		}

		if (opts.lockScroll !== false) {
			cleanups.push(useScrollLock())
		}

		opts.onOpen?.()
	}

	function close(): void {
		if (!isOpen.get()) return
		isOpen.set(false)

		cleanups.forEach(fn => fn())
		cleanups = []
		portal?.remove()
		portal = null
		backdrop = null

		opts.onClose?.()
	}

	function dispose(): void {
		close()
	}

	s?.onCleanup(dispose)
	return { open, close, isOpen, dispose }
}