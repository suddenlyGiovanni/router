import process from 'node:process'
import { describe, it } from 'node:test'

import Router from '../src/router'
import type * as Types from '../src/types'
import * as Utils from './support'

describe('Router', () => {
	describe('.param(name, fn)', () => {
		it('should reject missing name', () => {
			const router = new Router()
			Utils.assert.throws(
				// @ts-expect-error TS2769: No overload matches this call.
				router.param.bind(router),
				/argument name is required/,
			)
		})

		it('should reject bad name', () => {
			const router = new Router()
			Utils.assert.throws(
				// @ts-expect-error TS2769: No overload matches this call.
				router.param.bind(router, 42),
				/argument name must be a string/,
			)
		})

		it('should reject missing fn', () => {
			const router = new Router()
			Utils.assert.throws(
				// @ts-expect-error TS2769: No overload matches this call.
				router.param.bind(router, 'id'),
				/argument fn is required/,
			)
		})

		it('should reject bad fn', () => {
			const router = new Router()
			Utils.assert.throws(
				// @ts-expect-error TS2345: Argument of type number is not assignable to parameter of type RequestParamHandler
				router.param.bind(router, 'id', 42),
				/argument fn must be a function/,
			)
		})

		it('should map logic for a path param', (done) => {
			const cb = Utils.after(2, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('id', function parseId({ params }, _, next, val) {
				params['id'] = Number(val)
				next()
			})

			router.get('/user/:id', ({ params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params?.['id']}`)
			})

			Utils.request(server).get('/user/2').expect(200, 'get user 2', cb)

			Utils.request(server).get('/user/bob').expect(200, 'get user NaN', cb)
		})

		it('should allow chaining', (done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('id', function parseId({ params }, _, next, val) {
				params['id'] = Number(val)
				next()
			})

			router.param('id', function parseId(req, _, next, val) {
				req['itemId'] = Number(val)
				next()
			})

			router.get('/user/:id', ({ itemId, params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params['id']} (${itemId})`)
			})

			Utils.request(server).get('/user/2').expect(200, 'get user 2 (2)', done)
		})

		it('should automatically decode path value', (done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(req, _, next, user) {
				req['user'] = user
				next()
			})

			router.get('/user/:id', ({ params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params['id']}`)
			})

			Utils.request(server).get('/user/%22bob%2Frobert%22').expect('get user "bob/robert"', done)
		})

		it('should 400 on invalid path value', (done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(req, _, next, user) {
				req['user'] = user
				next()
			})

			router.get('/user/:id', ({ params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params?.['id']}`)
			})

			Utils.request(server)
				.get('/user/%bob')
				.expect(400, /URIError: Failed to decode param/, done)
		})

		it('should only invoke fn when necessary', (done) => {
			const cb = Utils.after(2, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('id', function parseId(_, res, next, val) {
				res.setHeader('x-id', val)
				next()
			})

			router.param('user', function parseUser(_req, _res, _next, _user) {
				throw new Error('boom')
			})

			router.get('/user/:user', saw)
			router.put('/user/:id', saw)

			Utils.request(server)
				.get('/user/bob')
				.expect(500, /Error: boom/, cb)

			Utils.request(server)
				.put('/user/bob')
				.expect('x-id', 'bob') //
				.expect('200', 'saw PUT /user/bob', cb)
		})

		it('should only invoke fn once per request', (done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(req, _, next, user) {
				req['count'] = (req['count'] ?? 0) + 1
				req['user'] = user
				next()
			})

			router.get('/user/:user', sethit(1))
			router.get('/user/:user', sethit(2))

			router.use((req, res) => {
				res.end(`get user ${req?.['user']} ${req?.['count']} times`)
			})

			Utils.request(server)
				.get('/user/bob') //
				.expect('get user bob 1 times', done)
		})

		it('should keep changes to req.params value', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('id', function parseUser(req, _, next, val) {
				req['count'] = (req?.['count'] ?? 0) + 1
				req.params['id'] = Number(val)
				next()
			})

			router.get('/user/:id', ({ params }, res, next) => {
				res.setHeader('x-user-id', params?.['id'])
				next()
			})

			router.get('/user/:id', (req, res) => {
				res.end(`get user ${req.params?.['id']} ${req?.['count']} times`)
			})

			Utils.request(server)
				.get('/user/01') //
				.expect('get user 1 1 times', done)
		})

		it('should invoke fn if path value differs', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(req, _, next, user) {
				req['count'] = (req?.['count'] ?? 0) + 1
				req['user'] = user
				req['vals'] = (req?.['vals'] || []).concat(user)
				next()
			})

			router.get('/:user/bob', sethit(1))
			router.get('/user/:user', sethit(2))

			router.use((req, res) => {
				res.end(
					`get user ${req?.['user']} ${req?.['count']} times: ${(req?.['vals'] ?? []).join(', ')}`,
				)
			})

			Utils.request(server).get('/user/bob').expect('get user bob 2 times: user, bob', done)
		})

		it('should catch exception in fn', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(_req, _res, _next, _user) {
				throw new Error('boom')
			})

			router.get('/user/:user', ({ params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params?.['id']}`)
			})

			Utils.request(server)
				.get('/user/bob')
				.expect('500', /Error: boom/, done)
		})

		it('should catch exception in chained fn', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.param('user', function parseUser(_req, _res, next, _user) {
				process.nextTick(next)
			})

			router.param('user', function parseUser(_req, _res, _next, _user) {
				throw new Error('boom')
			})

			router.get('/user/:user', ({ params }, res) => {
				res.setHeader('Content-Type', 'text/plain')
				res.end(`get user ${params?.['id']}`)
			})

			Utils.request(server)
				.get('/user/bob')
				.expect('500', /Error: boom/, done)
		})

		describe('next("route")', () => {
			it('should cause route with param to be skipped', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router()
				const server = Utils.createServer(router)

				router.param('id', function parseId(req, _, next, val) {
					const id = Number(val)

					if (Number.isNaN(id)) {
						return next('route')
					}

					req.params.id = id
					next()
				})

				router.get('/user/:id', ({ params }, res) => {
					res.setHeader('Content-Type', 'text/plain')
					res.end(`get user ${params?.['id']}`)
				})

				router.get('/user/new', (_, res) => {
					res.statusCode = 400
					res.setHeader('Content-Type', 'text/plain')
					res.end('cannot get a new user')
				})

				Utils.request(server)
					.get('/user/2') //
					.expect('200', 'get user 2', cb)

				Utils.request(server)
					.get('/user/bob') //
					.expect('404', cb)

				Utils.request(server)
					.get('/user/new') //
					.expect('400', 'cannot get a new user', cb)
			})

			it('should invoke fn if path value differs', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.param('user', function parseUser(req, _, next, user) {
					req['count'] = (req?.['count'] ?? 0) + 1
					req['user'] = user
					req['vals'] = (req?.['vals'] || []).concat(user)
					next(
						user === 'user'
							? 'route' //
							: null,
					)
				})

				router.get('/:user/bob', Utils.createHitHandle(1))
				router.get('/user/:user', Utils.createHitHandle(2))

				router.use((req, res) => {
					res.end(
						`get user ${req?.['user']} ${req?.['count']} times: ${(req?.['vals'] ?? []).join(', ')}`,
					)
				})

				Utils.request(server)
					.get('/user/bob')
					.expect(Utils.shouldNotHitHandle(1))
					.expect(Utils.shouldHitHandle(2))
					.expect('get user bob 2 times: user, bob', done)
			})
		})
	})
})

function sethit(num: number): Types.RouteHandler {
	const name = `x-fn-${String(num)}`
	return (_, res, next) => {
		res.setHeader(name, 'hit')
		next()
	}
}

function saw({ method, url }: Types.IncomingRequest, res: Types.ServerResponse): void {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}
