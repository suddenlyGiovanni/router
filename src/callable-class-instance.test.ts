import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

describe('Callable Class Instance', () => {
	class CallableClass implements Instance {
		private readonly value!: number

		constructor(value: number) {
			this.value = value

			return new Proxy(this, {
				apply(target, thisArg, argArray) {
					if (argArray.length !== 1) {
						throw new Error('Invalid number of arguments')
					}
					if (typeof argArray[0] !== 'number') {
						throw new Error('Invalid argument type')
					}
					return target.times(argArray[0])
				},
			}) as CallableClass & ((n: number) => number)
		}

		times(n: number): number {
			return this.value * n
		}
	}

	type Times = (n: number) => number

	interface Instance {
		times: Times
	}

	interface ConstructorWithCall {
		new (value: number): Instance & Times
		(value: number): Instance & Times
	}

	const Class = CallableClass as unknown as ConstructorWithCall

	it('instance should be a callable function that proxies to `instance.times`', () => {
		const instance = new Class(5)
		assert.equal(instance(2), instance.times(2))
	})

	it('should multiply the value by the given number', () => {
		const instance = new Class(5)
		assert.strictEqual(instance.times(2), 10)
	})

	it('instance should have the expected properties', () => {
		const instance = new Class(5)
		assert('times' in instance)
	})

	it('should throw an error if no arguments are provided', () => {
		const instance = new Class(5)
		assert.throws(() => {
			// @ts-expect-error Testing invalid number of arguments
			instance()
		}, /Invalid number of arguments/)
	})

	it('should throw an error if more than one argument is provided', () => {
		const instance = new Class(5)
		assert.throws(() => {
			// @ts-expect-error Testing invalid number of arguments
			instance(2, 3)
		}, /Invalid number of arguments/)
	})

	it('should throw an error if the argument is not a number', () => {
		const instance = new Class(5)
		assert.throws(() => {
			// @ts-expect-error Testing invalid argument type
			instance('string')
		}, /Invalid argument type/)
	})
})
