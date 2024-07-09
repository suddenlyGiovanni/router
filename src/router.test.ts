import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
// import Router from './router'

describe('restore', () => {
	/**
	 * Restore obj props after function
	 *
	 * @private
	 */
	function restore(fn, obj) {
		var props = new Array(arguments.length - 2)
		var vals = new Array(arguments.length - 2)

		for (var i = 0; i < props.length; i++) {
			props[i] = arguments[i + 2]
			vals[i] = obj[props[i]]
		}

		return function () {
			// restore vals
			for (var i = 0; i < props.length; i++) {
				obj[props[i]] = vals[i]
			}

			return fn.apply(this, arguments)
		}
	}

	test('restore function', () => {
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
		const restoreFn = restore(fn, obj, 'a', 'b')

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
})
