import { createRouter } from './router.ts'
import type { RouteDefinition, RouterOptions } from './router.ts'
import type { Container } from './container.ts'

export interface AppOptions {
	name?: string
	favicon?: string
	mountPoint?: string | HTMLElement
	containers?: Container[]
	routes?: RouteDefinition[]
	fallback?: RouterOptions['fallback']
	onError?: (err: unknown) => void
}

export interface App {
	use: (plugin: (app: App) => void) => App
	onInit: (fn: () => void | Promise<void>) => App
	init: () => Promise<void>
	mount: () => void
}

function containerToRoute(container: Container): RouteDefinition {
	if (!container.route) {
		throw new Error(
			'[createApp] container in `containers` array must have a `route`. ' +
			'Containers without routes are for nested use, not top-level registration.',
		)
	}
	return {
		path: container.route.path,
		container,
		guards: container.route.guards,
		meta: container.route.meta,
	}
}

function applyFavicon(favicon: string): void {
	const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
	const type = favicon.endsWith('.svg') ? 'image/svg+xml'
		: favicon.endsWith('.png') ? 'image/png'
			: favicon.endsWith('.ico') ? 'image/x-icon'
				: undefined

	if (existing) {
		existing.href = favicon
		if (type) existing.type = type
	} else {
		const link = document.createElement('link')
		link.rel = 'icon'
		link.href = favicon
		if (type) link.type = type
		document.head.appendChild(link)
	}
}

export function createApp(options: AppOptions): App {
	const {
		name,
		favicon,
		mountPoint = '#app',
		containers = [],
		routes = [],
		fallback,
		onError,
	} = options

	const allRoutes: RouteDefinition[] = [
		...containers.map(containerToRoute),
		...routes,
	]

	const initFns: Array<() => void | Promise<void>> = []
	const plugins: Array<(app: App) => void> = []

	const app: App = {
		use(plugin) { plugins.push(plugin); return app },
		onInit(fn) { initFns.push(fn); return app },

		async init() {
			const outletElement = typeof mountPoint === 'string'
				? document.querySelector<HTMLElement>(mountPoint)
				: mountPoint

			if (!outletElement) {
				throw new Error(`[createApp] Mount point "${mountPoint}" not found`)
			}

			if (favicon) applyFavicon(favicon)

			for (const plugin of plugins) plugin(app)
			for (const fn of initFns) await fn()

			const router = createRouter({
				outlet: outletElement,
				routes: allRoutes,
				fallback,
				appName: name,
				onError: onError ?? ((err) => console.error('[app]', err)),
			})

			router.interceptLinks()
		},

		mount() {
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', () => app.init())
			} else {
				app.init()
			}
		},
	}

	return app
}