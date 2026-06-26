import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

type EventTarget = Window | Document | HTMLElement

export function useEventListener<K extends keyof WindowEventMap>(
	target: Window,
	event: K,
	handler: (e: WindowEventMap[K]) => void,
	options?: AddEventListenerOptions,
	scope?: Scope,
): () => void

export function useEventListener<K extends keyof DocumentEventMap>(
	target: Document,
	event: K,
	handler: (e: DocumentEventMap[K]) => void,
	options?: AddEventListenerOptions,
	scope?: Scope,
): () => void

export function useEventListener<K extends keyof HTMLElementEventMap>(
	target: HTMLElement,
	event: K,
	handler: (e: HTMLElementEventMap[K]) => void,
	options?: AddEventListenerOptions,
	scope?: Scope,
): () => void

export function useEventListener(
	target: EventTarget,
	event: string,
	handler: (e: Event) => void,
	options?: AddEventListenerOptions,
	scope?: Scope,
): () => void {
	const s = resolveScope(scope)

	target.addEventListener(event, handler, options)

	const dispose = () => {
		target.removeEventListener(event, handler, options)
	}

	s?.onCleanup(dispose)
	return dispose
}