// dsl/form/array.ts

import { createScope, runInScope } from '../../core/scope.ts'
import type { Scope } from '../../core/scope.ts'
import type { Signal } from '../../core/signals.ts'
import type {
	ArrayNode,
	ClassValue,
	FormChild,
} from './types.ts'
import type { FieldContext } from './context.ts'

// ─── Class helper ─────────────────────────────────────────────────────────

function applyClass(el: HTMLElement, value: ClassValue): void {
	if (!value) return
	const cls = Array.isArray(value) ? value.join(' ') : value
	if (cls) el.className = cls
}

// ─── Row-scoped FieldContext ──────────────────────────────────────────────

function createRowContext(
	outer: FieldContext,
	arrayName: string,
	rowIndex: number,
	rowScope: Scope,
): FieldContext {
	const rowState: Signal<Record<string, unknown>> = {
		get: () => {
			const arr = (outer.state.get()[arrayName] as Record<string, unknown>[]) ?? []
			return arr[rowIndex] ?? {}
		},
		set: (newRowValue) => {
			outer.state.update((s) => {
				const arr = ((s[arrayName] as Record<string, unknown>[]) ?? []).slice()
				arr[rowIndex] = newRowValue
				return { ...s, [arrayName]: arr }
			})
		},
		update: (fn) => {
			outer.state.update((s) => {
				const arr = ((s[arrayName] as Record<string, unknown>[]) ?? []).slice()
				arr[rowIndex] = fn(arr[rowIndex] ?? {})
				return { ...s, [arrayName]: arr }
			})
		},
	}

	const prefix = `${arrayName}.${rowIndex}.`

	const rowErrors: Signal<Record<string, string>> = {
		get: () => {
			const all = outer.errors.get()
			const out: Record<string, string> = {}
			for (const [key, msg] of Object.entries(all)) {
				if (key.startsWith(prefix)) {
					out[key.slice(prefix.length)] = msg
				}
			}
			return out
		},
		set: (newRowErrors) => {
			outer.errors.update((all) => {
				const next: Record<string, string> = {}
				for (const [key, msg] of Object.entries(all)) {
					if (!key.startsWith(prefix)) next[key] = msg
				}
				for (const [k, msg] of Object.entries(newRowErrors)) {
					next[`${prefix}${k}`] = msg
				}
				return next
			})
		},
		update: (fn) => {
			rowErrors.set(fn(rowErrors.get()))
		},
	}

	return {
		state: rowState,
		errors: rowErrors,
		scope: rowScope,
		keyPrefix: prefix,
		onBlur: (fieldName) => outer.onBlur(`${prefix}${fieldName}`),
		onChange: (fieldName) => outer.onChange(`${prefix}${fieldName}`),
		registerRule: (ruleSet) => {
			outer.registerRule({
				name: `${prefix}${ruleSet.name}`,
				rules: ruleSet.rules,
				isRequired: ruleSet.isRequired,
				getValue: () => ruleSet.getValue(rowState.get()),
			})
		},
		validateFields: (keys) => outer.validateFields(keys.map(k => `${prefix}${k}`)),
	}
}

// ─── buildArray ───────────────────────────────────────────────────────────

export function buildArray(
	node: ArrayNode,
	ctx: FieldContext,
	buildField: (child: FormChild, ctx: FieldContext) => HTMLElement,
): HTMLElement {
	const wrapper = document.createElement('div')
	wrapper.classList.add('lolo-form-array')
	if (node.class) {
		const extra = Array.isArray(node.class) ? node.class : [node.class]
		for (const part of extra.flatMap(s => s.split(/\s+/))) {
			if (part) wrapper.classList.add(part)
		}
	}

	const tableEl = document.createElement('table')
	tableEl.className = 'lolo-form-array-table'

	const thead = document.createElement('thead')
	const headerRow = document.createElement('tr')
	for (const col of node.columns) {
		const th = document.createElement('th')
		th.textContent = col.header
		applyClass(th, col.headerClass ?? node.headerClass)
		headerRow.appendChild(th)
	}
	if (node.allowRemove) {
		const actionTh = document.createElement('th')
		actionTh.className = 'lolo-form-array-action-header'
		headerRow.appendChild(actionTh)
	}
	thead.appendChild(headerRow)
	tableEl.appendChild(thead)

	const tbody = document.createElement('tbody')
	tableEl.appendChild(tbody)

	wrapper.appendChild(tableEl)

	const emptyEl = document.createElement('div')
	emptyEl.className = 'lolo-form-array-empty'
	wrapper.appendChild(emptyEl)

	if (node.allowAdd) {
		const onAdd = (): void => {
			if (!node.newRow) {
				throw new Error(
					`[dsl/form/array] allowAdd is true but newRow is not provided for "${node.name}"`,
				)
			}
			ctx.state.update((s) => {
				const arr = ((s[node.name] as Record<string, unknown>[]) ?? []).slice()
				arr.push(node.newRow!() as Record<string, unknown>)
				return { ...s, [node.name]: arr }
			})
		}

		const addButton = node.addSlot
			? node.addSlot({ onAdd })
			: (() => {
				const btn = document.createElement('button')
				btn.type = 'button'
				btn.className = 'lolo-form-array-add'
				applyClass(btn, node.addClass)
				btn.textContent = node.addLabel ?? 'Add'
				btn.addEventListener('click', onAdd)
				return btn
			})()

		wrapper.appendChild(addButton)
	}

	let rowScopes: Scope[] = []

	function disposeRowScopes(): void {
		for (const scope of rowScopes) scope.dispose()
		rowScopes = []
	}

	function renderRows(): void {
		const arr = (ctx.state.get()[node.name] as Record<string, unknown>[] | undefined) ?? []

		disposeRowScopes()
		tbody.replaceChildren()
		emptyEl.replaceChildren()

		if (arr.length === 0) {
			if (node.emptySlot) {
				emptyEl.appendChild(node.emptySlot())
			}
			return
		}

		for (let i = 0; i < arr.length; i++) {
			const tr = document.createElement('tr')
			tr.setAttribute('data-row-index', String(i))
			tr.setAttribute('data-row-key', node.rowKey(arr[i] as never))
			applyClass(tr, node.rowClass)

			const rowScope = createScope()
			rowScopes.push(rowScope)

			const rowCtx = createRowContext(ctx, node.name, i, rowScope)

			runInScope(rowScope, () => {
				for (const col of node.columns) {
					const td = document.createElement('td')
					applyClass(td, col.cellClass ?? node.cellClass)
					const fieldEl = buildField(col.field, rowCtx)
					td.appendChild(fieldEl)
					tr.appendChild(td)
				}

				if (node.allowRemove) {
					const actionTd = document.createElement('td')
					actionTd.className = 'lolo-form-array-action-cell'
					const row = arr[i] as Record<string, unknown>
					const rowIndex = i
					const onRemove = (): void => {
						ctx.state.update((s) => {
							const next = ((s[node.name] as unknown[]) ?? []).slice()
							next.splice(rowIndex, 1)
							return { ...s, [node.name]: next }
						})
					}

					const removeEl = node.removeSlot
						? node.removeSlot({ onRemove, row: row as never, rowIndex })
						: (() => {
							const btn = document.createElement('button')
							btn.type = 'button'
							btn.className = 'lolo-form-array-remove'
							applyClass(btn, node.removeClass)
							btn.textContent = node.removeLabel ?? 'Remove'
							btn.addEventListener('click', onRemove)
							return btn
						})()

					actionTd.appendChild(removeEl)
					tr.appendChild(actionTd)
				}
			})

			tbody.appendChild(tr)
		}
	}

	ctx.scope.onCleanup(disposeRowScopes)

	ctx.scope.effect(() => {
		const arr = ctx.state.get()[node.name] as Record<string, unknown>[] | undefined
		void arr
		renderRows()
	})

	return wrapper
}