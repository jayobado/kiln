import { serveDir, serveFile } from '@std/http/file-server'
import { Router } from './router.ts'
import {
	requestId,
	securityHeaders,
	accessLog,
	errorHandler,
	compress,
} from './middleware.ts'
import {
	createTranspileHandler,
	warmTranspileCache,
	invalidateCache,
} from './transpile.ts'
import {
	hmrHandler,
	hmrClientScript,
	watchFs,
} from './hmr.ts'
import { Log } from './logger.ts'
import type { ServeOptions } from './types.ts'

// ─── run ──────────────────────────────────────────────────────────────────────

function run(router: Router, host: string, port: number): void {
	const server = Deno.serve(
		{
			port,
			hostname: host,
			onListen: () => {
				Log.info(`Server running at http://${host}:${port}`)
				console.log(`\n  ▲  http://${host}:${port}\n`)
			},
		},
		(req, info) => router.handle(req, info)
	)

	async function shutdown(): Promise<void> {
		Log.info('Shutting down...')
		await server.shutdown()
		await Log.flush()
		Deno.exit(0)
	}

	Deno.addSignalListener('SIGINT', shutdown)
	Deno.addSignalListener('SIGTERM', shutdown)
}

// ─── Inject HMR script ────────────────────────────────────────────────────────

function injectHmr(html: string): string {
	if (html.includes('</body>')) {
		return html.replace('</body>', `${hmrClientScript}</body>`)
	}
	return html + hmrClientScript
}

// ─── serve() ──────────────────────────────────────────────────────────────────

export async function serve(opts: ServeOptions): Promise<void> {
	const {
		host,
		port,
		fsRoot = './public',
		importMap,
		githubToken = Deno.env.get('GITHUB_TOKEN') ?? '',
		strategy = 'lazy',
		compilerOptions,
		routes,
		middleware = [],
	} = opts

	const hmrEnabled = opts.hmr ?? (strategy === 'lazy')

	const router = new Router()

	// ── Built-in middleware ────────────────────────────────────────────────────

	router.use(errorHandler())
	router.use(compress())
	router.use(requestId())
	router.use(securityHeaders())
	router.use(accessLog())

	// ── Custom middleware ──────────────────────────────────────────────────────

	for (const mw of middleware) {
		router.use(mw)
	}

	// ── HMR endpoint ──────────────────────────────────────────────────────────

	if (hmrEnabled) {
		router.get('/__hmr', (req) => hmrHandler(req))
	}

	// ── Project routes ─────────────────────────────────────────────────────────

	if (routes) routes(router)

	// ── Eager warm ────────────────────────────────────────────────────────────

	if (strategy === 'eager') {
		await warmTranspileCache({
			fsRoot,
			importMap,
			githubToken,
			compilerOptions,
		})
	}

	// ── TypeScript transpilation ───────────────────────────────────────────────

	const handleTranspile = createTranspileHandler({
		fsRoot,
		importMap,
		githubToken,
		compilerOptions,
	})

	// ── Static files + SPA fallback ────────────────────────────────────────────

	router.all('*', async (req) => {
		const url = new URL(req.url)

		// ── Transpile .ts/.tsx on the fly ──────────────────────────────────────
		if (
			url.pathname.endsWith('.ts') ||
			url.pathname.endsWith('.tsx') ||
			url.pathname.startsWith('/jsr/') ||
			url.pathname.startsWith('/npm/')
		) {
			return handleTranspile(req)
		}

		const response = await serveDir(req, {
			fsRoot,
			urlRoot: '',
			quiet: true,
		})

		if (
			response.status === 404 &&
			!url.pathname.includes('.')
		) {
			const indexPath = `${fsRoot}/index.html`

			if (hmrEnabled) {
				try {
					const html = await Deno.readTextFile(indexPath)
					return new Response(injectHmr(html), {
						headers: { 'Content-Type': 'text/html; charset=utf-8' },
					})
				} catch {
					return new Response('Not Found', { status: 404 })
				}
			}

			return serveFile(req, indexPath)
		}

		if (
			hmrEnabled &&
			response.status === 200 &&
			(response.headers.get('content-type') ?? '').includes('text/html')
		) {
			const html = await response.text()
			return new Response(injectHmr(html), {
				status: response.status,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			})
		}

		return response
	})

	// ── File watcher ───────────────────────────────────────────────────────────

	if (hmrEnabled) {
		watchFs(fsRoot, invalidateCache).catch(err => {
			Log.error(`[hmr] watcher error: ${err}`)
		})
	}

	run(router, host, port)
}