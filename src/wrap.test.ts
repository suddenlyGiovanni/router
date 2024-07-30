import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

describe('wrap', () => {
	type Wrap = <
		AnyFunction extends (...args: any[]) => any,
		F extends AnyFunction,
		G extends (...args: [F, ...Parameters<F>]) => ReturnType<F>,
	>(
		f: F,
		g: G,
	) => (...fArgs: Parameters<F>) => ReturnType<F>

	function testWrap(version: number, wrapStrategy: Wrap) {
		describe(`wrap ${version.toString()} function behavior`, () => {
			test('wrap returns a function', () => {
				const proxy = wrapStrategy(
					(number: number) => number,
					(f, number) => {
						console.log('before')
						const result = f(number)
						console.log('after')
						return result
					},
				)
				assert.strictEqual(typeof proxy, 'function')
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
				assert.deepStrictEqual(wrapperCall?.arguments, [originalFunction, 'testArg1', 'testArg2'])

				// Asserting the original function was called correctly
				assert.strictEqual(originalFunction.mock.calls.length, 1)
				const originalCall = originalFunction.mock.calls[0]
				assert.deepStrictEqual(originalCall?.arguments, ['testArg1', 'testArg2'])
			})

			test.skip('wrap preserves this context', () => {
				// Define a context object with a property to test `this` binding
				const context = { value: 42 }

				// Function that relies on `this` context
				function oldFunction(this: { value: number }, num: number): number {
					return this.value + num
				}

				// Wrapper function that calls the original function
				function wrapperFunction(
					this: { value: number },
					old: typeof oldFunction,
					num: number,
				): number {
					return old.call(this, num)
				}

				// Use the wrap function to wrap the original function with the wrapper

				const proxy = wrapStrategy(oldFunction, wrapperFunction)

				// Call the wrapped function and assert that `this` is correctly bound
				const result = proxy.call(context, 42)
				assert.strictEqual(result, 84, 'The wrapped function should preserve the this context')
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

	testWrap(1, function wrap(f, g) {
		return function proxy() {
			var args = new Array(arguments.length + 1)

			args[0] = f
			for (var i = 0, len = arguments.length; i < len; i++) {
				args[i + 1] = arguments[i]
			}

			return g.apply(this, args)
		}
	})

	testWrap(2, function wrap(f, g) {
		return function proxy(this: any, ...fArgs) {
			return g.apply(this, [f, ...fArgs])
		}
	})

	testWrap(3, function wrap(f, g) {
		return function proxy(this: any, ...fArgs) {
			return g.call(this, f, ...fArgs)
		}
	})

	testWrap(4, function wrap(f, g) {
		return function proxy(this: any, ...fArgs) {
			return g(f, ...fArgs)
		}
	})

	testWrap(5, function wrap(f, g) {
		return (...fArgs) => {
			return g(f, ...fArgs)
		}
	})

	testWrap(
		6,
		(f, g) =>
			(...fArgs) =>
				g(f, ...fArgs),
	)
})
