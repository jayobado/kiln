import type { Handler, Middleware, Route, Next } from './types.ts'

export class Router {
	readonly routes: Route[] = []
	readonly middleware: Middleware[] = []


	use(middleware: Middleware): this {
		this.middleware.push(middleware)
		return this
	}

	private add(methods: string[], path: string, handler: Handler): this {
		this.routes.push({
			pattern: new URLPattern({ pathname: path }),
			methods,
			handler,
		})
		return this
	}

	get(path: string, handler: Handler): this { return this.add(['GET'], path, handler) }
	post(path: string, handler: Handler): this { return this.add(['POST'], path, handler) }
	put(path: string, handler: Handler): this { return this.add(['PUT'], path, handler) }
	patch(path: string, handler: Handler): this { return this.add(['PATCH'], path, handler) }
	delete(path: string, handler: Handler): this { return this.add(['DELETE'], path, handler) }
	all(path: string, handler: Handler): this { return this.add([], path, handler) }

	/** Register a handler for an arbitrary HTTP method (used by the BFF action/route mounts). */
	on(method: string, path: string, handler: Handler): this {
		return this.add([method.toUpperCase()], path, handler)
	}

	async handle(
		req: Request,
		info: Deno.ServeHandlerInfo
	): Promise<Response> {
		const url = new URL(req.url)

		for (const route of this.routes) {
			const match = route.pattern.exec({ pathname: url.pathname })
			if (!match) continue

			const methodMatch =
				route.methods.length === 0 ||
				route.methods.includes(req.method.toUpperCase())

			if (!methodMatch) continue

			const params: Record<string, string> = {}
			const groups = match.pathname.groups
			for (const [key, val] of Object.entries(groups)) {
				if (val !== undefined) params[key] = val
			}

			return await this.runMiddleware(req, info, async () =>
				await route.handler(req, params, info)
			)
		}

		return new Response('Not Found', { status: 404 })
	}

	async runMiddleware(
		req: Request,
		info: Deno.ServeHandlerInfo,
		handler: () => Promise<Response>
	): Promise<Response> {
		const stack = [...this.middleware]
		let index = 0

		const next: Next = (): Promise<Response> => {
			if (index < stack.length) {
				const mw = stack[index++]
				return Promise.resolve(mw(req, next, info))
			}
			return handler()
		}

		return await next()
	}
}