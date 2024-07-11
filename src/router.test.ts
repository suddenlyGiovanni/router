import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
// import Router from './router'

describe('restore', () => {
	function testRestore(version: number, restoreStrategy: Function) {
		test(`restore ${version.toString()} function behavior`, () => {
			// Initial object
			const obj = { a: 1, b: 2, c: 42 }
			// Assert initial object properties
			assert.strictEqual(obj.a, 1, 'Initial value of a should be 1')
			assert.strictEqual(obj.b, 2, 'Initial value of b should be 2')
			assert.strictEqual(obj.c, 42, 'Initial value of b should be 42')

			// Function to be passed to restore (does nothing in this test)
			const fn = () => {}

			// Modify object properties
			obj.a = 3
			obj.b = 4

			// Assert modified object properties
			assert.strictEqual(obj.a, 3, 'Value of a after modification should be 3')
			assert.strictEqual(obj.b, 4, 'Value of b after modification should be 4')
			assert.strictEqual(obj.c, 42, 'Value of b after modification should be 42')

			// Call restore to save current state and get a restore function
			const restoreFn = restoreStrategy(fn, obj, 'a', 'b')

			// Modify properties again
			obj.a = 5
			obj.b = 6

			// Use the restore function to restore original properties
			restoreFn()

			// Assert properties are restored to their original values
			// Assert properties are restored to their values at the time of the restore function call
			assert.strictEqual(obj.a, 3, 'Value of a after restore should be 3')
			assert.strictEqual(obj.b, 4, 'Value of b after restore should be 4')
			assert.strictEqual(obj.c, 42, 'Value of b after restore should be 42')
		})
	}

	testRestore(1, function restore(fn: Function, obj: object) {
		// biome-ignore lint/style/noVar: <explanation>
		const props = new Array(arguments.length - 2)
		// biome-ignore lint/style/noVar: <explanation>
		const vals = new Array(arguments.length - 2)

		// biome-ignore lint/correctness/noInnerDeclarations: <explanation>
		for (let i = 0; i < props.length; i++) {
			// biome-ignore lint/style/noArguments: <explanation>
			props[i] = arguments[i + 2]
			// @ts-expect-error
			vals[i] = obj[props[i]]
		}

		return function <This>(this: This) {
			// restore vals
			// biome-ignore lint/correctness/noInnerDeclarations: <explanation>
			for (let i = 0; i < props.length; i++) {
				// @ts-expect-error
				obj[props[i]] = vals[i]
			}

			// biome-ignore lint/style/noArguments: <explanation>
			return fn.apply(this, arguments)
		}
	})

	testRestore(2, function restore<
		Obj extends object,
		ObjKeysToRestore extends Array<keyof Obj>,
		Fn extends Function,
	>(fn: Fn, obj: Obj, ...objKeysToRestore: ObjKeysToRestore) {
		const props: ObjKeysToRestore = new Array(objKeysToRestore.length) as ObjKeysToRestore
		const vals = new Array(objKeysToRestore.length)

		for (let i = 0; i < props.length; i++) {
			props[i] = objKeysToRestore[i]!
			vals[i] = obj[props[i]!]
		}

		return function <This>(this: This) {
			// restore vals
			for (let i = 0; i < props.length; i++) {
				obj[props[i]!] = vals[i]
			}
			return fn.apply(this, arguments)
		}
	})

	testRestore(3, function restore<
		Obj extends Record<string, unknown>,
		Keys extends keyof Obj,
		Fn extends (...args: unknown[]) => unknown,
	>(fn: Fn, obj: Obj, ...keys: [Keys]) {
		const originalValues = keys.reduce(
			(acc, key) => {
				acc[key] = obj[key]
				return acc
			},
			{} as Partial<Obj>,
		)

		return function (this: any, ...args: unknown[]) {
			// Restore original values
			// biome-ignore lint/complexity/noForEach: <explanation>
			keys.forEach((key) => {
				// @ts-expect-error
				obj[key] = originalValues[key]
			})

			// Call the original function
			const result = fn.apply(this, args)

			return result
		}
	})

	testRestore(4, function restore<
		Obj extends Record<string, any>,
		Keys extends keyof Obj,
		Fn extends (...args: any[]) => any,
	>(fn: Fn, obj: Obj, ...keys: Keys[]) {
		const originalValues = keys.reduce(
			(acc, key) => {
				acc[key] = obj[key]
				return acc
			},
			{} as Partial<Obj>,
		)

		// Using an arrow function here captures the `this` context lexically
		return (...args: any[]) => {
			// Restore original values
			// biome-ignore lint/complexity/noForEach: <explanation>
			keys.forEach((key) => {
				// @ts-expect-error
				obj[key] = originalValues[key]
			})

			// Directly call the function without `apply`, as `this` is lexically bound
			return fn(...args)
		}
	})

	testRestore(5, function restore5<
		Obj extends Record<string, any>,
		Keys extends (keyof Obj)[],
		Fn extends (...args: any[]) => any,
	>(fn: Fn, obj: Obj, ...keys: [...Keys]): (...args: Parameters<Fn>) => ReturnType<Fn> {
		const originalValues = keys.reduce(
			(acc, key) => {
				acc[key] = obj[key]
				return acc
			},
			{} as Partial<Obj>,
		)

		return (...args) => {
			// Restore original values
			// biome-ignore lint/complexity/noForEach: <explanation>
			keys.forEach((key) => {
				obj[key] = originalValues[key]
			})
			return fn(...args)
		}
	})

	test('restore 6 function behavior', () => {
		function restore6<
			Obj extends Record<string, any>,
			Keys extends (keyof Obj)[],
			Fn extends (...args: any[]) => any,
		>(fn: Fn, obj: Obj, ...keys: [...Keys]): (...args: Parameters<Fn>) => ReturnType<Fn> {
			const originalValues = keys.reduce(
				(acc, key) => {
					acc[key] = obj[key]
					return acc
				},
				{} as Obj[Keys[number]],
			)

			return (...args) => {
				for (const key of keys) {
					obj[key] = originalValues[key]
				}
				return fn(...args)
			}
		}

		// Initial object
		const obj = { a: 1, b: 2, c: 42 }

		// Assert initial object properties
		assert.strictEqual(obj.a, 1, 'Initial value of a should be 1')
		assert.strictEqual(obj.b, 2, 'Initial value of b should be 2')
		assert.strictEqual(obj.c, 42, 'Initial value of b should be 42')

		// Function to be passed to restore (does nothing in this test)
		const fn = (num: number) => {
			obj.a = 10
			return num * 2
		}

		// Modify object properties
		obj.a = 3
		obj.b = 4

		// Assert modified object properties
		assert.strictEqual(obj.a, 3, 'Value of a after modification should be 3')
		assert.strictEqual(obj.b, 4, 'Value of b after modification should be 4')
		assert.strictEqual(obj.c, 42, 'Value of b after modification should be 42')

		// Call restore to save current state and get a restore function
		const restoreFn = restore6(fn, obj, 'a', 'b')

		// Modify properties again
		obj.a = 5
		obj.b = 6

		// Use the restore function to restore original properties
		const x = restoreFn(42)

		// Assert properties are restored to their original values
		// Assert properties are restored to their values at the time of the restore function call
		assert.strictEqual(obj.a, 10, 'Value of a after restore should be 10')
		assert.strictEqual(obj.b, 4, 'Value of b after restore should be 4')
		assert.strictEqual(obj.c, 42, 'Value of b after restore should be 42')
		assert.strictEqual(x, 84)
	})
})

describe('wrap', () => {
	type AnyFunction = (...args: any[]) => any

	type Wrap = <
		Old extends AnyFunction,
		Fn extends (...args: [Old, ...Parameters<Old>]) => ReturnType<Old>,
	>(
		old: Old,
		fn: Fn,
	) => (...args: Parameters<Old>) => void

	function testWrap(version: number, wrapStrategy: Wrap) {
		describe(`wrap ${version.toString()} function behavior`, () => {
			test('wrap returns a function', (t) => {
				const oldFunction = () => {}
				const wrapperFunction = () => {}
				const result = wrapStrategy(oldFunction, wrapperFunction)
				assert.strictEqual(typeof result, 'function')
			})

			test('wrap correctly calls original and wrapper functions with arguments', (t) => {
				type Old = (arg1: string, arg2: string) => void
				const originalFunction = t.mock.fn<Old>()
				const wrapperFunction = t.mock.fn((old: Old, ...args: Parameters<Old>) => old(...args))
				const proxy = wrapStrategy(originalFunction, wrapperFunction)

				proxy('testArg1', 'testArg2')

				// Asserting the wrapper function was called correctly
				assert.strictEqual(wrapperFunction.mock.calls.length, 1)
				const wrapperCall = wrapperFunction.mock.calls[0]
				assert.deepStrictEqual(wrapperCall.arguments, [originalFunction, 'testArg1', 'testArg2'])

				// Asserting the original function was called correctly
				assert.strictEqual(originalFunction.mock.calls.length, 1)
				const originalCall = originalFunction.mock.calls[0]
				assert.deepStrictEqual(originalCall.arguments, ['testArg1', 'testArg2'])
			})

			test.skip('wrap preserves this context', () => {
				// Define a context object with a property to test `this` binding
				const context = { value: 42 }

				// Function that relies on `this` context
				function oldFunction(this: typeof context) {
					return this.value
				}

				// Wrapper function that calls the original function
				function wrapperFunction<Old extends Function>(this: typeof context, old: Old) {
					return old()
				}

				// Use the wrap function to wrap the original function with the wrapper

				const proxy = wrapStrategy(oldFunction, wrapperFunction).bind(context)

				// Call the wrapped function and assert that `this` is correctly bound
				const result = proxy()
				assert.strictEqual(result, 42, 'The wrapped function should preserve the this context')
			})

			test('wrap does not call the original function if the wrapper does not invoke it', (t) => {
				type Old = (arg: string) => void

				const originalFunction = t.mock.fn<Old>()
				const wrapperFunction = t.mock.fn<(...arg: [Old, ...Parameters<Old>]) => void>() // Does not call the original
				// function
				const proxy = wrapStrategy(originalFunction, wrapperFunction)

				proxy('testArg')

				assert.strictEqual(
					originalFunction.mock.calls.length,
					0,
					'Original function should not be called',
				)
			})

			test('wrap handles no arguments passed to proxy function', (t) => {
				const originalFunction = t.mock.fn()
				const wrapperFunction = t.mock.fn((old) => old())
				const proxy = wrapStrategy(originalFunction, wrapperFunction)

				proxy()

				assert.strictEqual(
					wrapperFunction.mock.calls.length,
					1,
					'Wrapper function should be called once',
				)
				assert.strictEqual(
					originalFunction.mock.calls.length,
					1,
					'Original function should be called once',
				)
			})
		})
	}

	testWrap(1, function wrap(old, fn) {
		return function proxy() {
			var args = new Array(arguments.length + 1)

			args[0] = old
			for (var i = 0, len = arguments.length; i < len; i++) {
				args[i + 1] = arguments[i]
			}

			fn.apply(this, args)
		}
	})

	testWrap(2, function wrap(old, fn) {
		return function proxy(this: any, ...args) {
			fn.apply(this, [old, ...args])
		}
	})

	testWrap(3, function wrap(old, fn) {
		return function proxy(this: any, ...args) {
			fn.call(this, old, ...args)
		}
	})
})
