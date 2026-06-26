import { signal } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

export interface LocalStorageReturn<T> {
	value: { get: () => T; set: (v: T) => void }
	remove: () => void
	dispose: () => void
}

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
	scope?: Scope,
): LocalStorageReturn<T> {
	const s = resolveScope(scope)

	function read(): T {
		try {
			const raw = localStorage.getItem(key)
			return raw !== null ? JSON.parse(raw) as T : initialValue
		} catch {
			return initialValue
		}
	}

	function write(v: T): void {
		try {
			localStorage.setItem(key, JSON.stringify(v))
		} catch { /* quota exceeded or unavailable */ }
	}

	const stored = signal<T>(read())

	// Wrap set to persist without mutating the original signal
	const value = {
		get: stored.get,
		set: (v: T) => {
			stored.set(v)
			write(v)
		},
	}

	function onStorage(e: StorageEvent): void {
		if (e.key !== key) return
		stored.set(e.newValue !== null ? JSON.parse(e.newValue) as T : initialValue)
	}

	globalThis.addEventListener('storage', onStorage)

	function remove(): void {
		localStorage.removeItem(key)
		stored.set(initialValue)
	}

	const dispose = () => {
		globalThis.removeEventListener('storage', onStorage)
	}

	s?.onCleanup(dispose)
	return { value, remove, dispose }
}