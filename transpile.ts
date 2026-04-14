import { transpile } from '@deno/emit'
import { Log } from './logger.ts'
import { resolve } from '@std/path'

export interface TranspileOptions {
	fsRoot: string
	importMap?: string | { imports: Record<string, string> }
	githubToken?: string
	compilerOptions?: Record<string, unknown>
}

// ─── Shared in-memory cache ───────────────────────────────────────────────────

const cache = new Map<string, string>()

// ─── Path normalisation ───────────────────────────────────────────────────────

function toFileUrl(path: string): string {
	if (path.startsWith('file://')) return path
	const abs = resolve(path)
	return `file://${abs}`
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

export function invalidateCache(path: string): void {
	const key = toFileUrl(path)
	cache.delete(key)
	Log.debug(`[transpile] cache invalidated: ${key}`)
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function createLoader(githubToken: string) {
	return async (specifier: string) => {
		if (!specifier.startsWith('http')) {
			try {
				const path = specifier.startsWith('file://')
					? new URL(specifier).pathname
					: specifier
				const content = await Deno.readTextFile(path)
				return { kind: 'module' as const, specifier, content }
			} catch {
				return undefined
			}
		}

		if (specifier.includes('raw.githubusercontent.com') && githubToken) {
			const res = await fetch(specifier, {
				headers: { Authorization: `token ${githubToken}` },
			})
			if (!res.ok) {
				throw new Error(
					`[transpile] Failed to fetch ${specifier}: ${res.status} ${res.statusText}`
				)
			}
			const content = await res.text()
			return { kind: 'module' as const, specifier, content }
		}

		try {
			const res = await fetch(specifier)
			if (!res.ok) return undefined
			const content = await res.text()
			return { kind: 'module' as const, specifier, content }
		} catch {
			return undefined
		}
	}
}

// ─── Transpile a single file ──────────────────────────────────────────────────

async function transpileFile(
	path: string,
	opts: TranspileOptions,
	loader: ReturnType<typeof createLoader>
): Promise<string | null> {
	const specifier = toFileUrl(path)

	if (cache.has(specifier)) return cache.get(specifier)!

	try {
		const result = await transpile(specifier, {
			importMap: opts.importMap,
			compilerOptions: opts.compilerOptions,
			load: loader,
		})

		const code = result.get(specifier)
		if (!code) return null

		cache.set(specifier, code)
		return code
	} catch (err) {
		await Log.error(
			`[transpile] ${specifier} — ${err instanceof Error ? err.message : String(err)}`
		)
		return null
	}
}

// ─── Eager warm ───────────────────────────────────────────────────────────────

export async function warmTranspileCache(opts: TranspileOptions): Promise<void> {
	const githubToken = opts.githubToken ?? Deno.env.get('GITHUB_TOKEN') ?? ''
	const loader = createLoader(githubToken)
	const start = performance.now()
	let count = 0

	await Log.info('Warming transpile cache...')

	async function walk(dir: string): Promise<void> {
		for await (const entry of Deno.readDir(dir)) {
			const full = `${dir}/${entry.name}`
			if (entry.isDirectory) {
				await walk(full)
				continue
			}
			if (
				entry.isFile && (
					entry.name.endsWith('.ts') ||
					entry.name.endsWith('.tsx')
				)
			) {
				const code = await transpileFile(full, opts, loader)
				if (code) {
					count++
					await Log.debug(`Cached: ${full.replace(opts.fsRoot, '')}`)
				}
			}
		}
	}

	await walk(opts.fsRoot)

	const elapsed = ((performance.now() - start) / 1000).toFixed(2)
	await Log.info(`Transpile cache ready — ${count} files in ${elapsed}s`)
}

// ─── ETag hash ────────────────────────────────────────────────────────────────

function hashCode(str: string): string {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash) + str.charCodeAt(i)
		hash |= 0
	}
	return Math.abs(hash).toString(36)
}

// ─── Request handler ──────────────────────────────────────────────────────────

export function createTranspileHandler(
	opts: TranspileOptions
): (req: Request) => Promise<Response> {
	const githubToken = opts.githubToken ?? Deno.env.get('GITHUB_TOKEN') ?? ''
	const loader = createLoader(githubToken)

	return async (req: Request): Promise<Response> => {
		const url = new URL(req.url)
		const path = url.pathname.startsWith('/pkg/')
			? `.${url.pathname}`
			: `${opts.fsRoot}${url.pathname}`

		try {
			const code = await transpileFile(path, opts, loader)

			if (!code) {
				return new Response('File not found', { status: 404 })
			}

			return new Response(code, {
				headers: {
					'Content-Type': 'application/javascript; charset=utf-8',
					'Cache-Control': 'no-cache',
					'ETag': `"${hashCode(code)}"`,
				},
			})
		} catch (err) {
			if (err instanceof Deno.errors.NotFound) {
				return new Response('File not found', { status: 404 })
			}
			await Log.error(
				`[transpile] ${err instanceof Error ? err.message : String(err)}`
			)
			return new Response('Transpilation error', { status: 500 })
		}
	}
}