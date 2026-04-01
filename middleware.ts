import type { Middleware } from './types.ts'
import { Log } from './logger.ts'

// ─── Request ID ───────────────────────────────────────────────────────────────

export function requestId(): Middleware {
	return async (_req, next) => {
		const id = crypto.randomUUID()
		const res = await next()
		const headers = new Headers(res.headers)
		headers.set('X-Request-Id', id)
		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers,
		})
	}
}

// ─── Security headers ─────────────────────────────────────────────────────────

export function securityHeaders(): Middleware {
	return async (_req, next) => {
		const res = await next()
		const headers = new Headers(res.headers)
		headers.set('X-Content-Type-Options', 'nosniff')
		headers.set('X-Frame-Options', 'DENY')
		headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
		headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers,
		})
	}
}

// ─── Access log ───────────────────────────────────────────────────────────────

export function accessLog(): Middleware {
	return async (req, next) => {
		const start = performance.now()
		const res = await next()
		const ms = (performance.now() - start).toFixed(1)
		const method = req.method
		const path = new URL(req.url).pathname
		const status = res.status
		const msg = `${method} ${path} ${status} ${ms}ms`

		if (status >= 500) await Log.error(msg)
		else if (status >= 400) await Log.warn(msg)
		else await Log.info(msg)

		return res
	}
}

// ─── Error handler ────────────────────────────────────────────────────────────

export function errorHandler(): Middleware {
	return async (req, next) => {
		try {
			return await next()
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			const path = new URL(req.url).pathname
			await Log.error(`${req.method} ${path} — ${message}`)
			return Response.json(
				{ message: 'Internal server error' },
				{ status: 500 }
			)
		}
	}
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

export interface CorsOptions {
	origins: string | string[]
	methods?: string[]
	allowHeaders?: string[]
	credentials?: boolean
	maxAge?: number
}

export function cors(opts: CorsOptions): Middleware {
	const allowed = Array.isArray(opts.origins) ? opts.origins : [opts.origins]
	const methods = opts.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
	const headers = opts.allowHeaders ?? ['Content-Type', 'Authorization']
	const maxAge = opts.maxAge ?? 7200
	const creds = opts.credentials ?? true

	function isAllowed(origin: string): boolean {
		return allowed.includes('*') || allowed.includes(origin)
	}

	return async (req, next) => {
		const origin = req.headers.get('Origin') ?? ''

		if (req.method === 'OPTIONS') {
			if (!isAllowed(origin)) {
				return new Response('Forbidden', { status: 403 })
			}
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': origin,
					'Access-Control-Allow-Methods': methods.join(', '),
					'Access-Control-Allow-Headers': headers.join(', '),
					'Access-Control-Max-Age': String(maxAge),
					'Access-Control-Allow-Credentials': String(creds),
				},
			})
		}

		const res = await next()
		const resHeaders = new Headers(res.headers)

		if (isAllowed(origin) && origin) {
			resHeaders.set('Access-Control-Allow-Origin', origin)
			resHeaders.set('Access-Control-Allow-Headers', headers.join(', '))
			resHeaders.set('Access-Control-Allow-Credentials', String(creds))
			resHeaders.set('Vary', 'Origin')
		}

		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers: resHeaders,
		})
	}
}