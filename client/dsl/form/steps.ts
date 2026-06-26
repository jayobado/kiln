// dsl/form/steps.ts

import { signal } from '../../core/signals.ts'
import type {
	ClassValue,
	FormChild,
	StepsContext,
	Steps,
} from './types.ts'
import type { FieldContext } from './context.ts'

// ─── Helpers ──────────────────────────────────────────────────────────────

function applyClass(el: HTMLElement, value: ClassValue): void {
	if (!value) return
	const cls = Array.isArray(value) ? value.join(' ') : value
	if (cls) el.className = cls
}

/**
 * Extract field keys to validate per step. Buttons skipped. Nested steps
 * not supported (would need different flattening; schema covers the case).
 */
function extractStepFieldKeys(fields: readonly FormChild[]): string[] {
	const keys: string[] = []
	for (const field of fields) {
		switch (field.node) {
			case 'input':
			case 'select':
			case 'textarea':
			case 'checkbox':
			case 'radio':
			case 'array':
				keys.push(field.name)
				break
			case 'steps':
				break  // nested steps unsupported
			case 'button':
				break
		}
	}
	return keys
}

// ─── buildSteps ───────────────────────────────────────────────────────────

export function buildSteps(
	node: Steps,
	ctx: FieldContext,
	buildField: (child: FormChild, ctx: FieldContext) => HTMLElement,
): HTMLElement {
	const wrapper = document.createElement('div')
	wrapper.classList.add('lolo-form-steps')
	if (node.class) {
		const extra = Array.isArray(node.class) ? node.class : [node.class]
		for (const part of extra.flatMap(s => s.split(/\s+/))) {
			if (part) wrapper.classList.add(part)
		}
	}

	const totalSteps = node.steps.length
	const currentStep = node.currentStepRef ?? signal(0)
	const stepFieldKeys: string[][] = node.steps.map(s => extractStepFieldKeys(s.fields))

	const labels = {
		next: node.nextLabel ?? 'Next',
		prev: node.prevLabel ?? 'Previous',
		submit: node.submitLabel ?? 'Submit',
	}

	// ─── Navigation logic ────────────────────────────────────────────────

	async function navigate(targetStep: number): Promise<void> {
		const target = Math.max(0, Math.min(totalSteps - 1, targetStep))
		const current = currentStep.get()

		if (target <= current) {
			currentStep.set(target)
			return
		}

		// Forward: validate each step from current to target - 1
		for (let i = current; i < target; i++) {
			const keysForStep = stepFieldKeys[i].map(k => ctx.keyPrefix + k)
			const valid = await ctx.validateFields(keysForStep)
			if (!valid) {
				currentStep.set(i)
				return
			}
		}

		currentStep.set(target)
	}

	function triggerSubmit(): Promise<void> {
		const form = wrapper.closest('form') as HTMLFormElement | null
		if (!form) {
			return Promise.reject(new Error('[dsl/form/steps] steps node is not inside a form'))
		}
		form.requestSubmit()
		return Promise.resolve()
	}

	// ─── Steps context (passed to slots) ─────────────────────────────────

	const stepsCtx: StepsContext = {
		currentStep: () => currentStep.get(),
		totalSteps,
		steps: node.steps,

		isFirst: () => currentStep.get() === 0,
		isLast: () => currentStep.get() === totalSteps - 1,

		isStepCurrent: (n) => currentStep.get() === n,
		isStepCompleted: (n) => n < currentStep.get(),
		isStepReachable: (n) => n <= currentStep.get(),

		labels,

		next: () => navigate(currentStep.get() + 1),
		prev: () => { if (currentStep.get() > 0) currentStep.set(currentStep.get() - 1) },
		goTo: (n) => navigate(n),
		submit: () => triggerSubmit(),
	}

	// ─── Default indicator (build once, reactive) ────────────────────────

	function buildDefaultIndicator(): HTMLElement {
		const el = document.createElement('div')
		el.className = 'lolo-form-steps-indicator'

		ctx.scope.effect(() => {
			el.textContent = `Step ${stepsCtx.currentStep() + 1} of ${stepsCtx.totalSteps}`
		})

		return el
	}

	// ─── Default nav (build once, reactive) ──────────────────────────────

	function buildDefaultNav(): HTMLElement {
		const nav = document.createElement('div')
		nav.className = 'lolo-form-steps-nav'

		const prev = document.createElement('button')
		prev.type = 'button'
		prev.className = 'lolo-form-steps-prev'
		prev.textContent = labels.prev
		prev.addEventListener('click', () => stepsCtx.prev())
		ctx.scope.effect(() => {
			prev.disabled = stepsCtx.isFirst()
		})

		const next = document.createElement('button')
		next.type = 'button'
		next.className = 'lolo-form-steps-next'
		next.textContent = labels.next
		next.addEventListener('click', () => { stepsCtx.next() })
		ctx.scope.effect(() => {
			next.style.display = stepsCtx.isLast() ? 'none' : ''
		})

		const submit = document.createElement('button')
		submit.type = 'submit'
		submit.className = 'lolo-form-steps-submit'
		submit.textContent = labels.submit
		ctx.scope.effect(() => {
			submit.style.display = stepsCtx.isLast() ? '' : 'none'
		})

		nav.append(prev, next, submit)
		return nav
	}

	// ─── Step content containers ─────────────────────────────────────────

	const contentWrapper = document.createElement('div')
	contentWrapper.className = 'lolo-form-steps-content'

	const stepContainers: HTMLDivElement[] = []
	for (let i = 0; i < node.steps.length; i++) {
		const container = document.createElement('div')
		container.className = 'lolo-form-steps-content-step'
		container.setAttribute('data-step', String(i))
		applyClass(container, node.stepClass)

		for (const field of node.steps[i].fields) {
			container.appendChild(buildField(field, ctx))
		}

		stepContainers.push(container)
		contentWrapper.appendChild(container)
	}

	// Show/hide step containers based on current step
	ctx.scope.effect(() => {
		const step = currentStep.get()
		for (let i = 0; i < stepContainers.length; i++) {
			stepContainers[i].style.display = i === step ? '' : 'none'
		}
	})

	// ─── Assemble ────────────────────────────────────────────────────────

	const indicator = node.indicatorSlot
		? node.indicatorSlot(stepsCtx)
		: buildDefaultIndicator()

	const nav = node.navSlot
		? node.navSlot(stepsCtx)
		: buildDefaultNav()

	wrapper.appendChild(indicator)
	wrapper.appendChild(contentWrapper)
	wrapper.appendChild(nav)

	return wrapper
}