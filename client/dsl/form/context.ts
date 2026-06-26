import type { Signal } from '../../core/signals.ts'
import type { Scope } from '../../core/scope.ts'
import type { ValidationRule } from './types.ts'

export interface FieldRuleSet {
	name: string
	rules: ValidationRule[]
	isRequired: boolean
	getValue: (state: Record<string, unknown>) => unknown
}

export interface FieldContext {
	state: Signal<Record<string, unknown>>
	errors: Signal<Record<string, string>>
	onBlur: (fieldName: string) => void
	onChange: (fieldName: string) => void
	scope: Scope
	keyPrefix: string
	registerRule: (ruleSet: FieldRuleSet) => void
	validateFields: (keys: readonly string[]) => Promise<boolean>
}