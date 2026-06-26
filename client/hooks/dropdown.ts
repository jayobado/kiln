import { signal } from '../core/signals.ts'
import { resolveScope } from '../core/scope.ts'
import type { Scope } from '../core/scope.ts'
import { createPortal } from '../primitives/portal.ts'
import { useClickOutside } from '../primitives/click-outside.ts'
import { useEscapeKey } from '../primitives/escape-key.ts'

export type DropdownPlacement = 'bottom'

export interface DropdownItem {
	label: string
	value?: string
	disabled?: boolean
	onSelect?: () => void
}

export interface DropdownOptions {
	items: DropdownItem[]
	placement?: DropdownPlacement
	offset?: number
	class?: string
	itemClass?: string
	activeItemClass?: string
	disabledItemClass?: string
	onSelect?: (item: DropdownItem) => void
}

export interface DropdownReturn {
	open: () => void
	close: () => void
	toggle: () => void
	isOpen: { get: () => boolean }
	dispose: () => void
}

// ─── Positioning ──────────────────────────────────────────────────────────

function placeBelow(
	trigger: HTMLElement,
	menu: HTMLElement,
	offset: number,
): { top: number; left: number } {
	const t = trigger.getBoundingClientRect()
	const m = menu.getBoundingClientRect()
	const viewportH = globalThis.innerHeight
	const viewportW = globalThis.innerWidth

	// Vertical: prefer below; flip up if not enough room and more space above
	const spaceBelow = viewportH - t.bottom
	const spaceAbove = t.top
	const flipUp = spaceBelow < m.height + offset && spaceAbove > spaceBelow

	const top = flipUp
		? Math.max(0, t.top - m.height - offset)
		: t.bottom + offset

	// Horizontal: align to trigger's left edge, clamp to viewport
	const left = Math.max(0, Math.min(t.left, viewportW - m.width))

	return { top, left }
}

// ─── useDropdown ──────────────────────────────────────────────────────────

export function useDropdown(
	trigger: HTMLElement,
	options: DropdownOptions,
	scope?: Scope,
): DropdownReturn {
	const s = resolveScope(scope)
	const isOpen = signal(false)
	const {
		items,
		placement: _placement = 'bottom',
		offset = 4,
	} = options

	let menu: HTMLElement | null = null
	let portal: { element: HTMLElement; remove: () => void } | null = null
	let activeIndex = -1
	let cleanups: Array<() => void> = []

	function getSelectableIndices(): number[] {
		return items.reduce<number[]>((acc, item, i) => {
			if (!item.disabled) acc.push(i)
			return acc
		}, [])
	}

	function updateActive(index: number): void {
		if (!menu) return
		const children = Array.from(menu.children) as HTMLElement[]
		children.forEach((child, i) => {
			if (i === index) {
				child.setAttribute('aria-selected', 'true')
				child.className = [
					options.itemClass ?? '',
					options.activeItemClass ?? '',
				].filter(Boolean).join(' ')
			} else {
				child.removeAttribute('aria-selected')
				const classes: string[] = []
				if (options.itemClass) classes.push(options.itemClass)
				if (items[i].disabled && options.disabledItemClass) {
					classes.push(options.disabledItemClass)
				}
				child.className = classes.join(' ')
			}
		})
		activeIndex = index
	}

	function selectItem(item: DropdownItem): void {
		if (item.disabled) return
		item.onSelect?.()
		options.onSelect?.(item)
		close()
	}

	function createMenu(): HTMLElement {
		const el = document.createElement('div')
		el.setAttribute('role', 'listbox')
		el.style.position = 'fixed'
		if (options.class) el.className = options.class

		items.forEach((item, i) => {
			const row = document.createElement('div')
			row.setAttribute('role', 'option')
			row.textContent = item.label

			const rowClasses: string[] = []
			if (options.itemClass) rowClasses.push(options.itemClass)
			if (item.disabled && options.disabledItemClass) {
				rowClasses.push(options.disabledItemClass)
			}
			if (rowClasses.length) row.className = rowClasses.join(' ')

			if (!item.disabled) {
				row.style.cursor = 'pointer'
				row.addEventListener('click', () => selectItem(item))
				row.addEventListener('mouseenter', () => updateActive(i))
			}

			el.appendChild(row)
		})

		return el
	}

	function onKeydown(e: KeyboardEvent): void {
		if (!isOpen.get()) return
		const selectable = getSelectableIndices()
		if (!selectable.length) return

		switch (e.key) {
			case 'ArrowDown': {
				e.preventDefault()
				const currentPos = selectable.indexOf(activeIndex)
				const next = currentPos < selectable.length - 1
					? selectable[currentPos + 1]
					: selectable[0]
				updateActive(next)
				break
			}
			case 'ArrowUp': {
				e.preventDefault()
				const currentPos = selectable.indexOf(activeIndex)
				const prev = currentPos > 0
					? selectable[currentPos - 1]
					: selectable[selectable.length - 1]
				updateActive(prev)
				break
			}
			case 'Enter': {
				e.preventDefault()
				if (activeIndex >= 0) selectItem(items[activeIndex])
				break
			}
		}
	}

	function open(): void {
		if (isOpen.get()) return
		isOpen.set(true)
		activeIndex = -1

		menu = createMenu()
		portal = createPortal(menu)

		const pos = placeBelow(trigger, menu, offset)
		menu.style.top = `${pos.top}px`
		menu.style.left = `${pos.left}px`

		cleanups.push(useClickOutside(() => menu, close))
		cleanups.push(useEscapeKey(close))
		document.addEventListener('keydown', onKeydown)
		cleanups.push(() => document.removeEventListener('keydown', onKeydown))
	}

	function close(): void {
		if (!isOpen.get()) return
		isOpen.set(false)
		activeIndex = -1

		cleanups.forEach(fn => fn())
		cleanups = []
		portal?.remove()
		portal = null
		menu = null

		trigger.focus()
	}

	function toggle(): void {
		isOpen.get() ? close() : open()
	}

	function dispose(): void {
		close()
	}

	s?.onCleanup(dispose)
	return { open, close, toggle, isOpen, dispose }
}