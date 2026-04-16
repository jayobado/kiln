import { transpile } from '@deno/emit'
import { resolve } from '@std/path'
import { Log } from './logger.ts'

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
	return `file://${resolve(path)}`
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

export function invalidateCache(path: string): void {
	const key = toFileUrl(path)
	cache.delete(key)
	Log.debug(`[transpile] cache invalidated: ${key}`)
}

// ─── Import map loading ───────────────────────────────────────────────────────

async function loadImportMap(
	importMap?: string | { imports: Record<string, string> }
): Promise<Record<string, string>> {
	if (!importMap) return {}
	if (typeof importMap === 'object') return importMap.imports ?? {}
	try {
		const raw = await Deno.readTextFile(importMap)
		const json = JSON.parse(raw)
		return json.imports ?? {}
	} catch {
		return {}
	}
}

// ─── Import rewriting ─────────────────────────────────────────────────────────

function resolveSpecifier(target: string): string | null {
	const jsrMatch = target.match(/^jsr:(@[^/]+\/[^@/]+)@([^/]+)(?:\/(.*))?$/)
	if (jsrMatch) {
		const [, pkg, version, subpath] = jsrMatch
		return `/jsr/${pkg}/${version}/${subpath ?? 'mod.ts'}`
	}

	const jsrNoVersion = target.match(/^jsr:(@[^/]+\/[^@/]+)(?:\/(.*))?$/)
	if (jsrNoVersion) {
		const [, pkg, subpath] = jsrNoVersion
		return `/jsr/${pkg}/${subpath ?? 'mod.ts'}`
	}

	const npmMatch = target.match(/^npm:(@?[^@/]+(?:\/[^@/]+)?)@([^/]+)(?:\/(.*))?$/)
	if (npmMatch) {
		const [, pkg, version, subpath] = npmMatch
		return `/npm/${pkg}@${version}${subpath ? '/' + subpath : ''}`
	}

	const npmNoVersion = target.match(/^npm:(@?[^@/]+(?:\/[^@/]+)?)(?:\/(.*))?$/)
	if (npmNoVersion) {
		const [, pkg, subpath] = npmNoVersion
		return `/npm/${pkg}${subpath ? '/' + subpath : ''}`
	}

	return null
}

function buildRewriteMap(imports: Record<string, string>): Map<string, string> {
	const rewrites = new Map<string, string>()
	for (const [alias, target] of Object.entries(imports)) {
		const resolved = resolveSpecifier(target)
		if (resolved) rewrites.set(alias, resolved)
	}
	return rewrites
}

function rewriteImports(code: string, rewrites: Map<string, string>): string {
	// Sort by length descending so "@jayobado/lolo-ui/form" matches before "@jayobado/lolo-ui"
	const sorted = [...rewrites.entries()].sort((a, b) => b[0].length - a[0].length)

	for (const [alias, servePath] of sorted) {
		const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		code = code.replaceAll(
			new RegExp(`(from\\s*['"])${escaped}(['"])`, 'g'),
			`$1${servePath}$2`
		)
		code = code.replaceAll(
			new RegExp(`(import\\s*\\(\\s*['"])${escaped}(['"]\\s*\\))`, 'g'),
			`$1${servePath}$2`
		)
	}
	return code
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

// ─── Resolve request path to transpile specifier ──────────────────────────────

function resolveRequestPath(pathname: string, fsRoot: string): string {
	if (pathname.startsWith('/jsr/')) {
		return `https://jsr.io${pathname.slice(4)}`
	}
	if (pathname.startsWith('/npm/')) {
		return `https://esm.sh/${pathname.slice(5)}`
	}
	return `${fsRoot}${pathname}`
}

// ─── Transpile a single file ──────────────────────────────────────────────────

async function transpileFile(
	path: string,
	opts: TranspileOptions,
	loader: ReturnType<typeof createLoader>,
	rewrites: Map<string, string>,
): Promise<string | null> {
	const specifier = path.startsWith('http') ? path : toFileUrl(path)

	if (cache.has(specifier)) return cache.get(specifier)!

	try {
		const result = await transpile(specifier, {
			importMap: opts.importMap,
			compilerOptions: opts.compilerOptions,
			load: loader,
		})

		let code = result.get(specifier)
		if (!code) return null

		code = rewriteImports(code, rewrites)

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
	const imports = await loadImportMap(opts.importMap)
	const rewrites = buildRewriteMap(imports)
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
				const code = await transpileFile(full, opts, loader, rewrites)
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
	let rewrites: Map<string, string> | null = null

	return async (req: Request): Promise<Response> => {
		if (!rewrites) {
			const imports = await loadImportMap(opts.importMap)
			rewrites = buildRewriteMap(imports)
		}

		const url = new URL(req.url)
		const path = resolveRequestPath(url.pathname, opts.fsRoot)

		try {
			const code = await transpileFile(path, opts, loader, rewrites)

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