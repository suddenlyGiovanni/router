import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import * as Utils from './utils'

describe('rafter', () => {
	test('exists', () => {
		assert(typeof Utils.after === 'function', 'after is not a function')
	})

	test('after when called with 0 invokes', (_, done) => {
		Utils.after(0, done)
	})

	test('after 1', (_, done) => {
		const next = Utils.after(1, done)
		next()
	})

	test('after 5', (_, done) => {
		const next = Utils.after(5, done)
		let i = 5

		while (i--) {
			next()
		}
	})

	test('manipulate count', (_, done) => {
		const next = Utils.after(1, done)
		let i = 5

		// @ts-expect-error count is set to readonly; modifying only for testing purposes
		next.count = i
		while (i--) {
			next()
		}
	})

	test('after terminates on error', (_, done) => {
		const next = Utils.after(2, (err: null | Error) => {
			assert.equal(err?.message, 'test')
			done()
		})
		next(new Error('test'))
		next(new Error('test2'))
	})

	test('gee', (_, done) => {
		const _done = Utils.after(2, done)

		function cb(err: null | Error): void {
			assert.equal(err?.message, '1')
			_done()
		}

		const next = Utils.after(3, cb, (err) => {
			assert.equal(err?.message, '2')
			_done()
		})

		next(null)
		next(new Error('1'))
		next(new Error('2'))
	})

	test('eee', (_, done) => {
		const _done = Utils.after(3, done)

		function cb(err: null | Error): void {
			assert.equal(err?.message, '1')
			_done()
		}

		const next = Utils.after(3, cb, (err) => {
			assert.equal(err?.message, '2')
			_done()
		})

		next(new Error('1'))
		next(new Error('2'))
		next(new Error('2'))
	})

	test('gge', (_, done) => {
		const cb = (err?: null | Error): void => {
			assert.equal(err?.message, '1')
			done()
		}

		const next = Utils.after(3, cb, (_err) => {
			// should not happen
			assert.ok(false)
		})

		next()
		next()
		next(new Error('1'))
	})

	test('egg', (_, done) => {
		const cb = (err?: null | Error): void => {
			assert.equal(err?.message, '1')
			done()
		}

		const next = Utils.after(3, cb, (_err) => {
			// should not happen
			assert.ok(false)
		})

		next(new Error('1'))
		next()
		next()
	})

	test('throws on too many calls', (_, done) => {
		const next = Utils.after(1, done)
		next()
		assert.throws(next, /after called too many times/)
	})
})
