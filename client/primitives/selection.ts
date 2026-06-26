import { signal, computed } from '../core/signals.ts'

export interface SelectionReturn<T> {
	selected: { get: () => Set<T> }
	isSelected: (item: T) => boolean
	toggle: (item: T) => void
	select: (item: T) => void
	deselect: (item: T) => void
	selectAll: (items: T[]) => void
	clear: () => void
	count: { get: () => number }
	toArray: () => T[]
}

export function useSelection<T>(): SelectionReturn<T> {
	const selected = signal<Set<T>>(new Set())

	const count = computed(() => selected.get().size)

	function isSelected(item: T): boolean {
		return selected.get().has(item)
	}

	function toggle(item: T): void {
		selected.update(set => {
			const next = new Set(set)
			if (next.has(item)) {
				next.delete(item)
			} else {
				next.add(item)
			}
			return next
		})
	}

	function select(item: T): void {
		if (isSelected(item)) return
		selected.update(set => {
			const next = new Set(set)
			next.add(item)
			return next
		})
	}

	function deselect(item: T): void {
		if (!isSelected(item)) return
		selected.update(set => {
			const next = new Set(set)
			next.delete(item)
			return next
		})
	}

	function selectAll(items: T[]): void {
		selected.set(new Set(items))
	}

	function clear(): void {
		selected.set(new Set())
	}

	function toArray(): T[] {
		return Array.from(selected.get())
	}

	return { selected, isSelected, toggle, select, deselect, selectAll, clear, count, toArray }
}