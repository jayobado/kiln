import { signal } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export interface ClipboardReturn {
	copy: (text: string) => Promise<void>
	copied: { get: () => boolean }
	dispose: () => void
}

export function useClipboard(
	options?: { resetDelay?: number },
	scope?: Scope,
): ClipboardReturn {
	const s = resolveScope(scope)
	const resetDelay = options?.resetDelay ?? 2000
	const copied = signal(false)
	let timer: number | undefined

	async function copy(text: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text)
			copied.set(true)
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => {
				copied.set(false)
			}, resetDelay) as unknown as number
		} catch {
			copied.set(false)
		}
	}

	const dispose = () => {
		if (timer) clearTimeout(timer)
		copied.set(false)
	}

	s?.onCleanup(dispose)
	return { copy, copied, dispose }
}