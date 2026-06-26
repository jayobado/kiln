import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Signal } from '../../core/signals.ts'

export type ClassValue = string | string[] | undefined

export interface ValidationRule<TState extends Record<string, unknown> = Record<string, unknown>> {
	test: (value: unknown, state: TState) => boolean
	message: string
}

interface Field<TState extends Record<string, unknown>> {
	name: keyof TState & string
	label?: string

	class?: ClassValue   // applied to wrapper (label or fieldset)
	inputClass?: ClassValue   // applied to the input element
	errorClass?: ClassValue   // applied to the error <span>

	required?: boolean           // sets HTML required attr; if no schema, prepends a required rule
	rules?: ValidationRule<TState>[]  // ignored when form.schema is set

	show?: (state: TState) => boolean
	disabled?: boolean | ((state: TState) => boolean)
}

export interface Input<TState extends Record<string, unknown>> extends Field<TState> {
	node: 'input'
	
	type?: 
		|'text' 
		| 'email' 
		| 'password' 
		| 'number' 
		| 'tel' 
		| 'url' 
		| 'search' 
		| 'date' 
		| 'time' 
		| 'datetime-local' 
		| 'month' 
		| 'week' 
		| 'color' 
		| 'range'
	
	placeholder?: string
	autocomplete?: AutoFill
}

export interface Select<TState extends Record<string, unknown>> extends Field<TState> {
	node: 'select'
	options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>
	placeholder?: string
}

export interface Textarea<TState extends Record<string, unknown>> extends Field<TState> {
	node: 'textarea'
	placeholder?: string
	rows?: number
}

export interface Checkbox<TState extends Record<string, unknown>> extends Field<TState> {
	node: 'checkbox'
}

export interface Radio<TState extends Record<string, unknown>> extends Field<TState> {
	node: 'radio'
	options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>
}

export interface Button<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'button'
	label: string
	class?: ClassValue
	action?: 'submit' | 'reset' | 'button'   // default 'button'
	disabled?: boolean | ((state: TState) => boolean)
	onClick?: (state: TState) => void
}

export interface ArrayColumn<TRow extends Record<string, unknown>> {
	header: string
	field: FormChild<TRow>
	class?: ClassValue
	headerClass?: ClassValue
	cellClass?: ClassValue
}

export interface ArrayNode
	<TState extends Record<string, unknown> = Record<string, unknown>, 
		TRow extends Record<string, unknown> = Record<string, unknown>> {
	node: 'array'
	name: keyof TState & string

	rowKey: (row: TRow) => string
	columns: readonly ArrayColumn<TRow>[]

	class?: ClassValue
	rowClass?: ClassValue
	cellClass?: ClassValue
	headerClass?: ClassValue

	allowAdd?: boolean
	addLabel?: string
	addClass?: ClassValue
	newRow?: () => TRow

	allowRemove?: boolean
	removeLabel?: string
	removeClass?: ClassValue

	// Slots
	addSlot?: (ctx: { onAdd: () => void }) => HTMLElement
	removeSlot?: (ctx: { onRemove: () => void; row: TRow; rowIndex: number }) => HTMLElement
	emptySlot?: () => HTMLElement
}

export interface Step<TState extends Record<string, unknown> = Record<string, unknown>> {
	label?: string
	fields: readonly FormChild<TState>[]
}

export interface StepsContext<TState extends Record<string, unknown> = Record<string, unknown>> {
	currentStep: () => number
	totalSteps: number
	steps: readonly Step<TState>[]

	isFirst: () => boolean
	isLast: () => boolean

	isStepCurrent: (step: number) => boolean
	isStepCompleted: (step: number) => boolean
	isStepReachable: (step: number) => boolean

	labels: {
		next: string
		prev: string
		submit: string
	}

	next: () => Promise<void>
	prev: () => void
	goTo: (step: number) => Promise<void>
	submit: () => Promise<void>
}

export interface Steps<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'steps'
	steps: readonly Step<TState>[]
	currentStepRef?: Signal<number>
	class?: ClassValue
	stepClass?: ClassValue
	nextLabel?: string
	prevLabel?: string
	submitLabel?: string

	indicatorSlot?: (ctx: StepsContext<TState>) => HTMLElement
	navSlot?: (ctx: StepsContext<TState>) => HTMLElement
}

export type FormChild<TState extends Record<string, unknown> = Record<string, unknown>> =
	| Input<TState>
	| Select<TState>
	| Textarea<TState>
	| Checkbox<TState>
	| Radio<TState>
	| ArrayNode<TState>
	| Steps<TState>
	| Button<TState>

export interface FormController {
	submit: () => void
	reset: () => void
}

export interface Form<TState extends Record<string, unknown> = Record<string, unknown>> {
	node: 'form'
	class?: ClassValue

	initial: TState
	onSubmit: (state: TState) => void | Promise<void>

	validateOn?: 'submit' | 'blur' | 'change'   // default 'submit'
	schema?: StandardSchemaV1                // takes precedence over per-field rules + required

	// Optional refs — engine writes through these
	state?: Signal<TState>
	errors?: Signal<Partial<Record<keyof TState, string>>>
	controller?: FormController

	children: readonly FormChild<TState>[]
}

