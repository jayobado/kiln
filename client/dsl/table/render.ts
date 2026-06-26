import { createScope, getScope, runInScope } from '../../core/scope.ts'
import type { Scope } from '../../core/scope.ts'
import type {
	ClassValue,
	PaginationInfo,
	SortState,
	Table,
} from './types.ts'

const scopeMap = new WeakMap<HTMLElement, Scope>()

function applyClass(el: HTMLElement, value: ClassValue): void {
	if (!value) return
	const cls = Array.isArray(value) ? value.join(' ') : value
	if (cls) el.className = cls
}

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, label'

function shouldFireRowClick(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false
	return !target.closest(INTERACTIVE_SELECTOR)
}

export function defineTable<TRow, TData = readonly TRow[]>(
	node: Table<TRow, TData>,
): Table<TRow, TData> {
	return node
}

function nextSortState<TRow>(
	current: SortState<TRow> | null,
	field: keyof TRow & string,
): SortState<TRow> | null {
	if (!current || current.field !== field) {
		return { field, direction: 'asc' }
	}
	if (current.direction === 'asc') return { field, direction: 'desc' }
	return null
}

function buildDefaultPagination(info: PaginationInfo): HTMLElement {
	const wrapper = document.createElement('div')
	wrapper.className = 'lolo-table-pagination'

	const prev = document.createElement('button')
	prev.type = 'button'
	prev.textContent = 'Previous'
	prev.className = 'lolo-table-pagination-prev'
	prev.disabled = !info.canPrev
	prev.addEventListener('click', info.prev)

	const indicator = document.createElement('span')
	indicator.className = 'lolo-table-pagination-info'
	indicator.textContent = `Page ${info.page} of ${info.totalPages}`

	const next = document.createElement('button')
	next.type = 'button'
	next.textContent = 'Next'
	next.className = 'lolo-table-pagination-next'
	next.disabled = !info.canNext
	next.addEventListener('click', info.next)

	wrapper.appendChild(prev)
	wrapper.appendChild(indicator)
	wrapper.appendChild(next)
	return wrapper
}

function build<TRow, TData>(
	node: Table<TRow, TData>,
	scope: Scope,
): HTMLElement {
	const root = document.createElement('div')
	root.classList.add('lolo-table-root')
	applyClass(root, node.class)
	if (node.class) root.classList.add('lolo-table-root')   // ensure base stays

	// Sub-containers for each render section
	const tableEl = document.createElement('table')
	tableEl.className = 'lolo-table'
	const thead = document.createElement('thead')
	const tbody = document.createElement('tbody')
	tableEl.appendChild(thead)
	tableEl.appendChild(tbody)

	const stateEl = document.createElement('div')
	stateEl.className = 'lolo-table-state'

	const paginationEl = document.createElement('div')
	paginationEl.className = 'lolo-table-pagination-container'

	root.appendChild(tableEl)
	root.appendChild(stateEl)
	root.appendChild(paginationEl)

	// ─── Header ──────────────────────────────────────────────────────────

	function renderHeader(): void {
		const tr = document.createElement('tr')

		const sort = node.sortRef ? node.sortRef.get() : null

		for (const col of node.columns) {
			const th = document.createElement('th')
			th.textContent = col.header
			applyClass(th, col.headerClass)

			if (col.key && col.sortable) {
				th.setAttribute('data-sortable', 'true')
				if (sort && sort.field === col.key) {
					th.setAttribute('data-sort', sort.direction)
				}
				th.addEventListener('click', () => {
					if (!node.sortRef || !col.key) return
					node.sortRef.set(nextSortState(node.sortRef.get(), col.key))
				})
			}

			tr.appendChild(th)
		}

		thead.replaceChildren(tr)
	}

	// Initial header + re-render when sort changes
	scope.effect(() => {
		if (node.sortRef) node.sortRef.get()   // track dependency
		renderHeader()
	})

	// ─── Body ────────────────────────────────────────────────────────────

	function renderBody(rows: readonly TRow[]): void {
		const fragment = document.createDocumentFragment()

		for (const row of rows) {
			const tr = document.createElement('tr')
			tr.setAttribute('data-row-key', node.rowKey(row))

			if (node.onRowClick) {
				tr.style.cursor = 'pointer'
				tr.addEventListener('click', (e) => {
					if (shouldFireRowClick(e.target)) {
						node.onRowClick!(row)
					}
				})
			}

			for (const col of node.columns) {
				const td = document.createElement('td')
				applyClass(td, col.cellClass)

				if (col.render) {
					const content = col.render(row)
					if (typeof content === 'string') td.textContent = content
					else td.appendChild(content)
				} else if (col.key) {
					td.textContent = String(row[col.key] ?? '')
				}

				tr.appendChild(td)
			}

			fragment.appendChild(tr)
		}

		tbody.replaceChildren(fragment)
	}

	// ─── State slots (loading, error, empty) ─────────────────────────────

	function renderState(content: HTMLElement | null): void {
		if (content) stateEl.replaceChildren(content)
		else stateEl.replaceChildren()
	}

	function defaultLoading(): HTMLElement {
		const el = document.createElement('div')
		el.className = 'lolo-table-loading'
		el.textContent = 'Loading...'
		return el
	}

	function defaultEmpty(): HTMLElement {
		const el = document.createElement('div')
		el.className = 'lolo-table-empty'
		el.textContent = 'No results'
		return el
	}

	function defaultError(err: Error): HTMLElement {
		const el = document.createElement('div')
		el.className = 'lolo-table-error'
		el.textContent = `Error: ${err.message}`
		return el
	}

	// ─── Pagination ──────────────────────────────────────────────────────

	function renderPagination(): void {
		if (!node.pagination) return

		const data = node.query.data.get()
		if (data === undefined) {
			paginationEl.replaceChildren()
			return
		}

		const totalRows = node.pagination.totalRows(data)
		if (totalRows === 0) {
			paginationEl.replaceChildren()
			return
		}

		const { pageRef, pageSize } = node.pagination
		const page = pageRef.get()
		const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
		const canPrev = page > 1
		const canNext = page < totalPages

		const info: PaginationInfo = {
			page,
			totalPages,
			totalRows,
			pageSize,
			canPrev,
			canNext,
			goTo: (n) => pageRef.set(Math.max(1, Math.min(totalPages, n))),
			next: () => { if (canNext) pageRef.set(page + 1) },
			prev: () => { if (canPrev) pageRef.set(page - 1) },
		}

		const ui = node.paginationSlot
			? node.paginationSlot(info)
			: buildDefaultPagination(info)

		paginationEl.replaceChildren(ui)
	}

	// ─── The orchestrating effect ────────────────────────────────────────

	scope.effect(() => {
		const data = node.query.data.get()
		const error = node.query.error.get()
		const loading = node.query.loading.get()

		// Refetch indicator
		if (loading && data !== undefined) {
			root.classList.add('lolo-table--refetching')
		} else {
			root.classList.remove('lolo-table--refetching')
		}

		// Error wins over everything
		if (error) {
			tbody.replaceChildren()
			renderState(node.errorSlot ? node.errorSlot(error) : defaultError(error))
			paginationEl.replaceChildren()
			return
		}

		// First-load: no data yet, show loading slot
		if (data === undefined) {
			tbody.replaceChildren()
			renderState(node.loadingSlot ? node.loadingSlot() : defaultLoading())
			paginationEl.replaceChildren()
			return
		}

		// We have data — render body
		const rows = node.rows(data)

		if (rows.length === 0) {
			tbody.replaceChildren()
			renderState(node.emptySlot ? node.emptySlot() : defaultEmpty())
		} else {
			renderBody(rows)
			renderState(null)
		}

		renderPagination()
	})

	scopeMap.set(root, scope)
	return root
}

export function renderTable<TRow, TData = readonly TRow[]>(
	node: Table<TRow, TData>,
): HTMLElement {
	const parentScope = getScope()
	const scope = createScope()
	if (parentScope) parentScope.onCleanup(() => scope.dispose())

	return runInScope(scope, () => build(node, scope))
}