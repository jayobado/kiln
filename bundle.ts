import { bundle } from '@deno/emit'
import { Log } from './logger.ts'
import type { BundleOptions, BundleResult } from './types.ts'

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
					`Failed to fetch ${specifier}: ${res.status} ${res.statusText}`
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

// ─── Content hash ─────────────────────────────────────────────────────────────

async function contentHash(content: string): Promise<string> {
	const data = new TextEncoder().encode(content)
	const digest = await crypto.subtle.digest('SHA-256', data)
	const hex = Array.from(new Uint8Array(digest))
		.map(b => b.toString(16).padStart(2, '0'))
		.join('')
	return hex.slice(0, 8)
}

// ─── Rewrite index.html ───────────────────────────────────────────────────────

async function rewriteIndexHtml(
	fsRoot: string,
	outDir: string,
	outFile: string
): Promise<void> {
	const indexSrc = `${fsRoot}/index.html`

	let html: string
	try {
		html = await Deno.readTextFile(indexSrc)
	} catch {
		await Log.warn(`[bundle] index.html not found at ${indexSrc} — skipping`)
		return
	}

	const bundleName = outFile.split('/').pop()!
	html = html.replace(
		/<script type="module" src="[^"]+\.(ts|tsx)"><\/script>/g,
		`<script type="module" src="/${bundleName}"></script>`
	)

	await Deno.writeTextFile(`${outDir}/index.html`, html)
	await Log.info(`[bundle] wrote ${outDir}/index.html`)
}

// ─── Copy static assets ───────────────────────────────────────────────────────

async function copyAssets(fsRoot: string, outDir: string): Promise<void> {
	const skip = new Set(['.ts', '.tsx'])

	async function walk(dir: string): Promise<void> {
		for await (const entry of Deno.readDir(dir)) {
			const src = `${dir}/${entry.name}`
			const rel = src.replace(fsRoot, '')
			const dest = `${outDir}${rel}`

			if (entry.isDirectory) {
				await Deno.mkdir(dest, { recursive: true })
				await walk(src)
				continue
			}

			const ext = entry.name.includes('.')
				? `.${entry.name.split('.').pop()}`
				: ''

			if (skip.has(ext) || entry.name === 'index.html') continue

			await Deno.copyFile(src, dest)
		}
	}

	await walk(fsRoot)
}

// ─── buildBundle ──────────────────────────────────────────────────────────────

export async function buildBundle(opts: BundleOptions): Promise<BundleResult> {
	const {
		entry,
		outDir = './dist',
		importMap,
		githubToken = Deno.env.get('GITHUB_TOKEN') ?? '',
		compilerOptions,
		minify = false,
	} = opts

	const start = performance.now()

	await Log.info(`[bundle] building ${entry}...`)

	const { code } = await bundle(entry, {
		importMap,
		compilerOptions,
		load: createLoader(githubToken),
		minify,
	})

	await Deno.mkdir(outDir, { recursive: true })

	const hash = await contentHash(code)
	const name = entry.split('/').pop()!.replace(/\.(ts|tsx)$/, '')
	const outFile = `${outDir}/${name}.${hash}.js`

	await Deno.writeTextFile(outFile, code)

	const bytes = new TextEncoder().encode(code).length
	const kb = (bytes / 1024).toFixed(1)
	const elapsed = ((performance.now() - start) / 1000).toFixed(2)

	await Log.info(`[bundle] ${outFile} (${kb} KB) in ${elapsed}s`)

	return { outFile, bytes, elapsed }
}

// ─── build ────────────────────────────────────────────────────────────────────

export async function build(
	opts: BundleOptions,
	fsRoot: string = './public'
): Promise<void> {
	const outDir = opts.outDir ?? './dist'

	try {
		await Deno.remove(outDir, { recursive: true })
	} catch {
		// doesn't exist yet
	}
	await Deno.mkdir(outDir, { recursive: true })

	const result = await buildBundle(opts)

	await rewriteIndexHtml(fsRoot, outDir, result.outFile)
	await copyAssets(fsRoot, outDir)

	const kb = (result.bytes / 1024).toFixed(1)
	console.log(`\n  ✓ Built to ${outDir} (${kb} KB) in ${result.elapsed}s\n`)
}