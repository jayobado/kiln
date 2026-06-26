import type { Auth } from '../auth/factory.ts'
import type { BaseSessionData } from '../auth/store.ts'
import { mergeCredentialHeaders } from './headers.ts'
import { UpstreamError } from './error.ts'

/**
 * Per-upstream credential mapping. When provided, overrides the auth instance's
 * default credential mapper for this upstream only — for backends that share
 * the BFF's auth provider but expect a different credential format.
 */
export type UpstreamCredentials<S extends BaseSessionData = BaseSessionData> = {
	toHeaders: (session: S) => Record<string, string>
}

export type UpstreamOptions<S extends BaseSessionData = BaseSessionData> = {
	/** Base URL prepended to all paths. e.g. 'https://api.example.com' */
	baseUrl: string
	/** Auth instance providing the session + credential mapping for `forRequest`. */
	auth?: Auth<S>
	/** Credential mapper. Takes precedence over auth's mapper for this upstream. */
	credentials?: UpstreamCredentials<S>
	/** Default headers sent on every request. */
	defaultHeaders?: Record<string, string>
	/** Request timeout in ms. Default 30000. Pass 0 to disable (streaming). */
	timeoutMs?: number
}

export type RequestOptions = {
	/** Additional headers for this request. */
	headers?: Record<string, string>
	/** Override the default timeout. Pass 0 to disable (SSE, long polls, downloads). */
	timeoutMs?: number
}

/**
 * A session-bound upstream client. Its methods take no request — credentials are
 * fixed at bind time, so the same client works in a handler or a server-side caller.
 */
export type BoundUpstream = {
	/** Low-level fetch — returns the raw Response. Use for streaming, binary, non-REST. */
	fetch(path: string, init?: RequestInit & RequestOptions): Promise<Response>
	/** GET, returns parsed JSON. Throws UpstreamError on non-2xx. */
	get<T = unknown>(path: string, options?: RequestOptions): Promise<T>
	/** POST with JSON body, returns parsed JSON. */
	post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
	/** PUT with JSON body, returns parsed JSON. */
	put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
	/** PATCH with JSON body, returns parsed JSON. */
	patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
	/** DELETE, returns parsed JSON or undefined for empty responses. */
	delete<T = unknown>(path: string, options?: RequestOptions): Promise<T>
	/** Build headers without a request — for non-REST clients (Connect, tRPC, etc.). */
	headers(perRequest?: Record<string, string>): Record<string, string>
}

export type Upstream<S extends BaseSessionData = BaseSessionData> = {
	/** Bind to a session directly (server-side path; the main entry point). */
	forSession(session: S | null): BoundUpstream
	/** Bind to the current request's session (reads it via `auth`, forwards cookies). */
	forRequest(req: Request): Promise<BoundUpstream>
}

export function createUpstream<S extends BaseSessionData = BaseSessionData>(
	options: UpstreamOptions<S>,
): Upstream<S> {
	const baseUrl = options.baseUrl.replace(/\/$/, '')
	const defaults = options.defaultHeaders ?? {}
	const auth = options.auth
	const credentialOverride = options.credentials
	const defaultTimeoutMs = options.timeoutMs ?? 30000

	const url = (path: string): string => {
		const cleanPath = path.startsWith('/') ? path : `/${path}`
		return baseUrl + cleanPath
	}

	// Resolve credential headers for a known session: override wins, else auth's mapper.
	const credentialsFor = (session: S): Record<string, string> => {
		if (credentialOverride) return credentialOverride.toHeaders(session)
		return auth?.credentials?.headersFor(session) ?? {}
	}

	const forSession = (session: S | null): BoundUpstream =>
		createBound(defaultTimeoutMs, url, (perRequest) =>
			mergeCredentialHeaders({
				defaults,
				credHeaders: session ? credentialsFor(session) : {},
				cookie: null,
				perRequest,
			}))

	const forRequest = async (req: Request): Promise<BoundUpstream> => {
		const session = (await auth?.getSession(req)) ?? null
		const cookie = session && auth?.credentials ? auth.credentials.forwardedCookies(req) : null
		return createBound(defaultTimeoutMs, url, (perRequest) =>
			mergeCredentialHeaders({
				defaults,
				credHeaders: session ? credentialsFor(session) : {},
				cookie,
				perRequest,
			}))
	}

	return { forSession, forRequest }
}

/**
 * Build a session-bound client. `buildHeaders` closes over the resolved
 * credentials (fixed at bind time); everything below is request-free.
 */
function createBound(
	defaultTimeoutMs: number,
	url: (path: string) => string,
	buildHeaders: (perRequest?: Record<string, string>) => Record<string, string>,
): BoundUpstream {
	const fetchRaw = async (
		path: string,
		init: RequestInit & RequestOptions = {},
	): Promise<Response> => {
		const targetUrl = url(path)
		const timeoutMs = init.timeoutMs ?? defaultTimeoutMs
		const useTimeout = timeoutMs > 0

		const controller = useTimeout ? new AbortController() : null
		const timer = useTimeout ? setTimeout(() => controller!.abort(), timeoutMs) : null

		const mergedHeaders = buildHeaders(init.headers as Record<string, string> | undefined)

		try {
			return await fetch(targetUrl, {
				...init,
				headers: mergedHeaders,
				signal: init.signal ?? controller?.signal,
			})
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				throw new UpstreamError(`Request timed out after ${timeoutMs}ms`, {
					url: targetUrl,
					method: init.method ?? 'GET',
					cause: err,
				})
			}
			throw new UpstreamError(`Upstream fetch failed: ${targetUrl}`, {
				url: targetUrl,
				method: init.method ?? 'GET',
				cause: err,
			})
		} finally {
			if (timer) clearTimeout(timer)
		}
	}

	const jsonRequest = async <T>(
		method: string,
		path: string,
		body: unknown,
		requestOptions: RequestOptions = {},
	): Promise<T> => {
		const init: RequestInit & RequestOptions = {
			method,
			headers: {
				...(body !== undefined && { 'Content-Type': 'application/json' }),
				...requestOptions.headers,
			},
			...(body !== undefined && { body: JSON.stringify(body) }),
			timeoutMs: requestOptions.timeoutMs,
		}

		const response = await fetchRaw(path, init)

		if (!response.ok) {
			let errorBody: unknown
			try {
				errorBody = await response.json()
			} catch {
				try {
					errorBody = await response.text()
				} catch {
					errorBody = undefined
				}
			}
			throw new UpstreamError(`Upstream returned ${response.status}: ${method} ${path}`, {
				status: response.status,
				url: url(path),
				method,
				body: errorBody,
			})
		}

		if (response.status === 204 || response.headers.get('Content-Length') === '0') {
			return undefined as T
		}

		return await response.json() as T
	}

	return {
		fetch: fetchRaw,
		get: <T>(path: string, options?: RequestOptions) =>
			jsonRequest<T>('GET', path, undefined, options),
		post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
			jsonRequest<T>('POST', path, body, options),
		put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
			jsonRequest<T>('PUT', path, body, options),
		patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
			jsonRequest<T>('PATCH', path, body, options),
		delete: <T>(path: string, options?: RequestOptions) =>
			jsonRequest<T>('DELETE', path, undefined, options),
		headers: (perRequest) => buildHeaders(perRequest),
	}
}
