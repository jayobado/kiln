import {
	createScope,
	onCleanup,
	runInScope,
	type Scope,
} from '../scope.ts'
import { bind } from './bind.ts'
import { mountChild } from './mount.ts'
import type { Child, Reactive } from '../vnode.ts'

const CF = Symbol('lolo.controlFlow')

/**
 * A control-flow node owns its own structural reactivity — mounting,
 * unmounting, and reordering DOM in response to signal changes. Unlike
 * element/component VNodes, control-flow nodes manage their lifetime
 * directly via their `mount` method.
 *
 * `when` and `each` are the two primitives. Both work by inserting an
 * anchor comment node where they live in the tree, then mounting their
 * dynamic content before the anchor (or relative to other captured
 * nodes for `each`).
 */
export interface ControlFlowNode {
	readonly [CF]: true
	mount(parent: Element, anchor: Node | null): void
}

export function isControlFlowNode(x: unknown): x is ControlFlowNode {
	return (
		x !== null &&
		typeof x === 'object' &&
		(x as { [CF]?: true })[CF] === true
	)
}

// ---------------- when ----------------

/**
 * Conditional rendering. When `predicate` is truthy, mounts `then()`;
 * otherwise mounts `otherwise()` (or nothing if not provided).
 *
 * Branches own their own scopes — the inactive branch's scope is
 * disposed when the predicate flips, and a fresh scope is established
 * for the new branch. So effects inside `then`/`otherwise` don't leak
 * across switches.
 *
 * Usage:
 *   when(isLoggedIn, () => UserMenu({}), () => LoginButton({}))
 *   when(() => count.get() > 5, () => p({ class: 'warn' }, 'High'))
 */
export function when(
	predicate: Reactive<unknown>,
	then: () => Child,
	otherwise?: () => Child,
): ControlFlowNode {
	return {
		[CF]: true,
		mount(parent, anchor) {
			const startMarker = document.createComment('when')
			insertBefore(parent, startMarker, anchor)

			let branchScope: Scope | null = null
			let branchNodes: Node[] = []
			let currentBranch: 'then' | 'else' | 'none' = 'none'

			bind(predicate, (v) => {
				const want: 'then' | 'else' | 'none' = v
					? 'then'
					: otherwise
						? 'else'
						: 'none'

				if (want === currentBranch) return

				// Tear down previous branch
				branchScope?.dispose()
				branchScope = null
				for (const n of branchNodes) (n as ChildNode).remove()
				branchNodes = []

				// Mount new branch (if any)
				if (want !== 'none') {
					branchScope = createScope()
					runInScope(branchScope, () => {
						const renderFn = want === 'then' ? then : otherwise!
						mountChild(renderFn(), parent, startMarker, branchNodes)
					})
				}
				currentBranch = want
			})

			// Clean up when the surrounding scope disposes.
			onCleanup(() => {
				branchScope?.dispose()
				for (const n of branchNodes) (n as ChildNode).remove()
				startMarker.remove()
			})
		},
	}
}

// ---------------- each ----------------

interface Row {
	key: unknown
	scope: Scope
	nodes: Node[]
}

/**
 * Iterate over a reactive list. For each item, calls `render(item,
 * index)` to produce a Child. On list changes, performs keyed
 * reconciliation:
 *   - Items with the same key are preserved (DOM and scope reused)
 *   - New items are mounted with fresh scopes
 *   - Removed items have their scopes disposed and DOM removed
 *   - Reorders move existing DOM into the correct position
 *
 * `keyFn` is required. It must return a stable identifier per item
 * across updates — typically `item.id` for objects with stable IDs,
 * or `(_, i) => i` for explicitly positional keying (append-only
 * lists, no reordering or middle deletion).
 *
 * Usage:
 *   each(items, (item, i) => li({}, item.name), (item) => item.id)
 *   each(steps, (step, i) => div({}, step.label), (_, i) => i)
 */

export function each<T>(
	items: Reactive<readonly T[]>,
	render: (item: T, index: number) => Child,
	keyFn: (item: T, index: number) => unknown,
): ControlFlowNode {
	return {
		[CF]: true,
		mount(parent, anchor) {
			const startMarker = document.createComment('each')
			insertBefore(parent, startMarker, anchor)

			let rows = new Map<unknown, Row>()

			bind(items, (next) => {
				const nextRows = new Map<unknown, Row>()
				let insertAfter: Node = startMarker

				for (let i = 0; i < next.length; i++) {
					const item = next[i]
					const key = keyFn(item, i)

					const existing = rows.get(key)
					if (existing) {
						ensurePosition(parent, existing.nodes, insertAfter)
						nextRows.set(key, existing)
						rows.delete(key)
						insertAfter =
							existing.nodes[existing.nodes.length - 1] ?? insertAfter
					} else {
						const scope = createScope()
						const nodes: Node[] = []
						runInScope(scope, () => {
							mountChild(
								render(item, i),
								parent,
								insertAfter.nextSibling,
								nodes,
							)
						})
						nextRows.set(key, { key, scope, nodes })
						insertAfter = nodes[nodes.length - 1] ?? insertAfter
					}
				}

				for (const removed of rows.values()) {
					removed.scope.dispose()
					for (const n of removed.nodes) (n as ChildNode).remove()
				}

				rows = nextRows
			})

			onCleanup(() => {
				for (const row of rows.values()) {
					row.scope.dispose()
					for (const n of row.nodes) (n as ChildNode).remove()
				}
				startMarker.remove()
			})
		},
	}
}

// ---------------- helpers ----------------

function insertBefore(parent: Element, node: Node, anchor: Node | null): void {
	if (anchor) parent.insertBefore(node, anchor)
	else parent.appendChild(node)
}

/**
 * Ensure `nodes` (a row's DOM nodes, in order) sit immediately after
 * `insertAfter`. If they're already in position, no-op. Otherwise
 * move them with `insertBefore` calls.
 *
 * Used by `each` to reorder rows when their position changes between
 * updates. Idempotent — calling on an already-correctly-positioned
 * row does no DOM work.
 */
function ensurePosition(
	parent: Element,
	nodes: Node[],
	insertAfter: Node,
): void {
	if (nodes.length === 0) return
	if (nodes[0].previousSibling === insertAfter) return

	let ref: Node | null = insertAfter.nextSibling
	for (const n of nodes) {
		parent.insertBefore(n, ref)
		ref = n.nextSibling
	}
}