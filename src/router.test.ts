import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
// import Router from './router'

describe('restore', () => {
	function testRestore(version: number, restoreStrategy: Function) {
		test(`restore ${version.toString()} function behavior`, () => {
			// Initial object
			const obj = { a: 1, b: 2 }

			// Assert initial object properties
			assert.strictEqual(obj.a, 1, 'Initial value of a should be 1')
			assert.strictEqual(obj.b, 2, 'Initial value of b should be 2')

			// Function to be passed to restore (does nothing in this test)
			const fn = () => {}

			// Modify object properties
			obj.a = 3
			obj.b = 4

			// Assert modified object properties
			assert.strictEqual(obj.a, 3, 'Value of a after modification should be 3')
			assert.strictEqual(obj.b, 4, 'Value of b after modification should be 4')

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
})
