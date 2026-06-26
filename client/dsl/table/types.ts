import type { Signal } from '../../core/signals.ts'
import type { QueryReturn } from '../../query/query.ts'
import type { ClassValue } from '../form/types.ts'

export type { ClassValue }

export type SortDirection = 'asc' | 'desc'

export interface SortState<TRow> {
	field: keyof TRow & string
	direction: SortDirection
}

export interface Pagination<TData> {
	pageRef: Signal<number>
	pageSize: number
	totalRows: (data: TData) => number
}

export interface PaginationInfo {
	page: number
	totalPages: number
	totalRows: number
	pageSize: number
	canPrev: boolean
	canNext: boolean
	goTo: (page: number) => void
	next: () => void
	prev: () => void
}

export interface Column<TRow> {
	key?: keyof TRow & string
	header: string
	class?: ClassValue
	headerClass?: ClassValue
	cellClass?: ClassValue
	sortable?: boolean
	render?: (row: TRow) => HTMLElement | string
}

export interface Table<TRow, TData = readonly TRow[]> {
	node: 'table'
	class?: ClassValue

	query: QueryReturn<TData>
	rows: (data: TData) => readonly TRow[]

	rowKey: (row: TRow) => string
	columns: readonly Column<TRow>[]

	sortRef?: Signal<SortState<TRow> | null>
	pagination?: Pagination<TData>

	onRowClick?: (row: TRow) => void

	loadingSlot?: () => HTMLElement
	errorSlot?: (err: Error) => HTMLElement
	emptySlot?: () => HTMLElement
	paginationSlot?: (info: PaginationInfo) => HTMLElement
}