import type { Router } from '../router.ts'

export type HealthOptions = {
	/** Path prefix for the endpoints. Default ''. e.g. '/internal' → '/internal/health'. */
	prefix?: string

	/** Build metadata returned by `/version`. */
	version?: string
	commit?: string
	builtAt?: string

	/**
	 * Readiness check. Return true if the process can serve traffic (downstream
	 * deps reachable, etc.). Should be fast — orchestrators poll `/ready` hard.
	 * If it throws or returns false, `/ready` answers 503. Default: always ready.
	 */
	ready?: () => boolean | Promise<boolean>
}

/**
 * Mount conventional health endpoints on a kiln Router:
 *
 *   GET {prefix}/health   → 200 if the process is alive (always 200)
 *   GET {prefix}/ready    → 200 if it can serve traffic, 503 otherwise
 *   GET {prefix}/version  → 200 with build metadata
 *
 * `serve({ health })` calls this for you, ahead of static serving. The
 * health/ready split matters: `/health` is "is the process running?",
 * `/ready` is "should this instance receive traffic?" — a dependency-starved
 * instance can be alive but not ready.
 */
export function mountHealth(router: Router, options: HealthOptions = {}): void {
	const prefix = options.prefix ?? ''
	const ready = options.ready

	router.get(`${prefix}/health`, () => Response.json({ status: 'ok' }))

	router.get(`${prefix}/ready`, async () => {
		if (!ready) return Response.json({ status: 'ok' })
		try {
			return (await ready())
				? Response.json({ status: 'ok' })
				: Response.json({ status: 'not_ready' }, { status: 503 })
		} catch (err) {
			return Response.json(
				{ status: 'not_ready', error: err instanceof Error ? err.message : String(err) },
				{ status: 503 },
			)
		}
	})

	router.get(`${prefix}/version`, () =>
		Response.json({
			version: options.version,
			commit: options.commit,
			builtAt: options.builtAt,
		}))
}
