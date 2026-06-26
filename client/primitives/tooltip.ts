export interface TooltipConfig {
	class?: string       // class applied to tooltip element
	delay?: number       // ms before show, default 400
	hideDelay?: number   // ms before hide, default 100
	offset?: number      // px from trigger, default 8
}

// ─── Module-level state ───────────────────────────────────────────────────

let config: TooltipConfig = {}
let enabled = false
let active: HTMLElement | null = null
let showTimer: number | undefined
let hideTimer: number | undefined

// ─── Internals ────────────────────────────────────────────────────────────

function show(trigger: HTMLElement): void {
	const text = trigger.getAttribute('data-tooltip')
	if (!text) return

	if (hideTimer) { clearTimeout(hideTimer); hideTimer = undefined }
	if (active) return

	showTimer = setTimeout(() => {
		const el = document.createElement('div')
		el.setAttribute('role', 'tooltip')
		if (config.class) el.className = config.class
		el.style.position = 'fixed'
		el.style.pointerEvents = 'none'
		el.textContent = text

		document.body.appendChild(el)

		// Place above trigger, centered; flip below if not enough room
		const t = trigger.getBoundingClientRect()
		const m = el.getBoundingClientRect()
		const offset = config.offset ?? 8
		const flipDown = t.top < m.height + offset

		const top = flipDown
			? t.bottom + offset
			: t.top - m.height - offset

		const left = Math.max(0, Math.min(
			t.left + (t.width - m.width) / 2,
			globalThis.innerWidth - m.width,
		))

		el.style.top = `${top}px`
		el.style.left = `${left}px`

		active = el
	}, config.delay ?? 400) as unknown as number
}

function hide(): void {
	if (showTimer) { clearTimeout(showTimer); showTimer = undefined }
	hideTimer = setTimeout(() => {
		if (active) {
			active.remove()
			active = null
		}
	}, config.hideDelay ?? 100) as unknown as number
}

function onEnter(e: Event): void {
	const target = (e.target as Element).closest?.('[data-tooltip]')
	if (target instanceof HTMLElement) show(target)
}

function onLeave(e: Event): void {
	const target = (e.target as Element).closest?.('[data-tooltip]')
	if (target instanceof HTMLElement) hide()
}

// ─── Public API ───────────────────────────────────────────────────────────

export function enableTooltips(c?: TooltipConfig): void {
	if (enabled) {
		console.warn('[tooltip] enableTooltips already called; ignoring')
		return
	}
	config = c ?? {}
	enabled = true

	document.addEventListener('mouseover', onEnter, true)
	document.addEventListener('mouseout', onLeave, true)
	document.addEventListener('focusin', onEnter, true)
	document.addEventListener('focusout', onLeave, true)
}