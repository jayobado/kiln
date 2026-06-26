import { createScope, runInScope } from './scope.ts'
import type { Scope } from './scope.ts'
import type { GuardFn, RouteContext } from './types.ts'

const scopeMap = new WeakMap<HTMLElement, Scope>()

export interface ContainerContext {
	effect: Scope['effect']
	onCleanup: Scope['onCleanup']
}

export interface RouteConfig {
	path: string
	title?: string | ((context: RouteContext) => string)
	guards?: GuardFn[]
	meta?: Record<string, unknown>
}

export interface ContainerDefinition<S = unknown> {
	route?: RouteConfig
	setup: (ctx: ContainerContext) => S
	content: (setup: S) => HTMLElement
}

export interface Container {
	readonly route?: RouteConfig
	render: () => HTMLElement
}

export function defineContainer<S>(def: ContainerDefinition<S>): Container {
	return {
		route: def.route,
		render() {
			const scope = createScope()
			const ctx: ContainerContext = {
				effect: scope.effect,
				onCleanup: scope.onCleanup,
			}

			const setupReturn = runInScope(scope, () => def.setup(ctx))
			const rootEl = runInScope(scope, () => def.content(setupReturn))

			scopeMap.set(rootEl, scope)
			return rootEl
		},
	}
}

export function disposeContainer(el: HTMLElement): void {
	scopeMap.get(el)?.dispose()
}