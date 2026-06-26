export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
	duration?: number       // ms, 0 = sticky, default 3000
	variant?: ToastVariant  // default 'info'
	dismissible?: boolean   // default true
	class?: string          // extra class on the toast element
}

export interface ToastConfig {
	containerClass?: string
	variantClass?: Partial<Record<ToastVariant, string>>
}

// ─── Module-level state ───────────────────────────────────────────────────

let container: HTMLElement | null = null
let config: ToastConfig = {}
let configured = false

// ─── Configuration ────────────────────────────────────────────────────────

export function configureToasts(c: ToastConfig): void {
	if (configured) {
		console.warn('[toast] configureToasts already called; ignoring')
		return
	}
	config = c
	configured = true
}

// ─── Internals ────────────────────────────────────────────────────────────

function ensureContainer(): HTMLElement {
	if (container) return container
	container = document.createElement('div')
	container.setAttribute('aria-live', 'polite')
	container.setAttribute('role', 'status')
	if (config.containerClass) container.className = config.containerClass
	document.body.appendChild(container)
	return container
}

function show(message: string, options?: ToastOptions): void {
	const {
		duration = 3000,
		variant = 'info',
		dismissible = true,
	} = options ?? {}

	const root = ensureContainer()
	const el = document.createElement('div')
	el.setAttribute('role', 'alert')

	const classes: string[] = []
	if (options?.class) classes.push(options.class)
	if (config.variantClass?.[variant]) classes.push(config.variantClass[variant]!)
	if (classes.length) el.className = classes.join(' ')

	el.textContent = message

	let timer: number | undefined

	function remove(): void {
		if (timer) clearTimeout(timer)
		if (el.parentNode === root) root.removeChild(el)
	}

	if (dismissible) {
		el.style.cursor = 'pointer'
		el.addEventListener('click', remove)
	}

	root.appendChild(el)

	if (duration > 0) {
		timer = setTimeout(remove, duration) as unknown as number
	}
}

function clear(): void {
	if (container) container.replaceChildren()
}

// ─── Public API ───────────────────────────────────────────────────────────

type VariantShortcut = (msg: string, opts?: Omit<ToastOptions, 'variant'>) => void

export const toast: {
	show: (msg: string, opts?: ToastOptions) => void
	info: VariantShortcut
	success: VariantShortcut
	warning: VariantShortcut
	error: VariantShortcut
	clear: () => void
} = {
	show,
	info: (msg, opts) => show(msg, { ...opts, variant: 'info' }),
	success: (msg, opts) => show(msg, { ...opts, variant: 'success' }),
	warning: (msg, opts) => show(msg, { ...opts, variant: 'warning' }),
	error: (msg, opts) => show(msg, { ...opts, variant: 'error' }),
	clear,
}