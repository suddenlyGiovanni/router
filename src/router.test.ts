import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Router from './router'

describe('Router', () => {
	describe('restore', () => {
		it('should restore properties after function execution', () => {
			class TestRouter extends Router {
				public static override restore<
					Obj extends object,
					ObjKeysToRestore extends Array<keyof Obj>,
					Fn extends Function,
				>(fn: Fn, obj: Obj, ...objKeysToRestore: ObjKeysToRestore) {
					return Router.restore(fn, obj, ...objKeysToRestore)
				}
			}

			const testFunction = function (this: typeof testObject) {
				this.prop1 = 'temp'
				this.prop2 = 'temp'
			}

			const testObject = {
				prop1: 'original',
				prop2: 'original',
			}

			// Call the restore method
			const restoredFunction = TestRouter.restore(
				testFunction.bind(testObject),
				testObject,
				'prop1',
				'prop2',
			)

			// Execute the returned function
			restoredFunction()

			// Check the values
			assert.equal(testObject.prop1, 'original')
			assert.equal(testObject.prop2, 'original')
		})
	})
})
