import { signal, effect } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryOptions {
	enabled?: () => boolean
	retry?: number
	retryDelay?: number
	onError?: (err: Error) => void
}

export interface QueryReturn<T> {
	data: { get: () => T | undefined }
	error: { get: () => Error | undefined }
	loading: { get: () => boolean }
	refetch: () => Promise<void>
}

// ─── Implementation ──────────────────────────────────────────────────────────

export function useQuery<T>(
	fn: () => Promise<T>,
	options?: QueryOptions,
	scope?: Scope,
): QueryReturn<T> {
	const s = resolveScope(scope)

	const data = signal<T | undefined>(undefined)
	const error = signal<Error | undefined>(undefined)
	const loading = signal(false)

	const maxRetries = options?.retry ?? 0
	const retryDelay = options?.retryDelay ?? 1000

	let generation = 0

	async function execute(): Promise<void> {
		const current = ++generation
		error.set(undefined)
		loading.set(true)

		let attempt = 0
		while (true) {
			try {
				const result = await fn()
				if (current !== generation) return
				data.set(result)
				error.set(undefined)
				break
			} catch (err) {
				if (current !== generation) return
				const e = err instanceof Error ? err : new Error(String(err))
				if (attempt < maxRetries) {
					attempt++
					await new Promise(r => setTimeout(r, retryDelay))
					if (current !== generation) return
					continue
				}
				error.set(e)
				options?.onError?.(e)
				break
			}
		}

		if (current === generation) {
			loading.set(false)
		}
	}

	const dispose = effect(() => {
		const enabled = options?.enabled ? options.enabled() : true
		if (!enabled) return
		execute()
	})

	s?.onCleanup(dispose)

	return { data, error, loading, refetch: execute }
}