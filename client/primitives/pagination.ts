import { signal, computed } from '../core/signals.ts'
import type { Signal } from '../core/signals.ts'

export interface PaginationOptions {
	page?: number
	pageSize?: number
	total?: number
}

export interface PaginationReturn {
	page: Signal<number>
	pageSize: Signal<number>
	total: Signal<number>
	totalPages: { get: () => number }
	hasNext: { get: () => boolean }
	hasPrev: { get: () => boolean }
	next: () => void
	prev: () => void
	goTo: (page: number) => void
	reset: () => void
}

export function usePagination(options?: PaginationOptions): PaginationReturn {
	const initialPage = options?.page ?? 1
	const page = signal(initialPage)
	const pageSize = signal(options?.pageSize ?? 10)
	const total = signal(options?.total ?? 0)

	const totalPages = computed(() => {
		const size = pageSize.get()
		return size > 0 ? Math.ceil(total.get() / size) : 0
	})

	const hasNext = computed(() => page.get() < totalPages.get())
	const hasPrev = computed(() => page.get() > 1)

	function next(): void {
		if (hasNext.get()) page.update(p => p + 1)
	}

	function prev(): void {
		if (hasPrev.get()) page.update(p => p - 1)
	}

	function goTo(p: number): void {
		const clamped = Math.max(1, Math.min(p, totalPages.get() || 1))
		page.set(clamped)
	}

	function reset(): void {
		page.set(initialPage)
	}

	return { page, pageSize, total, totalPages, hasNext, hasPrev, next, prev, goTo, reset }
}