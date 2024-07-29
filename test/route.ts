import { describe, it } from 'node:test'
import { Buffer } from 'safe-buffer'

import { methods } from '../src/methods'
import Router from '../src/router'
import type * as Types from '../src/types'
import * as Utils from './support'

describe('Router', () => {
	describe('.route(path)', () => {
		it('should return a new route', () => {
			const router = new Router()
			const route = router.route('/foo')
			Utils.assert.equal(route.path, '/foo')
		})

		it('should respond to multiple methods', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const route = router.route('/foo')
			const server = Utils.createServer(router)

			route.get(saw)
			route.post(saw)

			Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

			Utils.request(server).post('/foo').expect(200, 'saw POST /foo', cb)

			Utils.request(server).put('/foo').expect(404, cb)
		})

		it('should route without method', (_, done) => {
			const router = new Router()
			const route = router.route('/foo')
			const server = Utils.createServer((req, res, next) => {
				req.method = undefined
				router.handle(req, res, next)
			})

			route.post(Utils.createHitHandle(1))
			route.all(Utils.createHitHandle(2))
			route.get(Utils.createHitHandle(3))

			router.get('/foo', Utils.createHitHandle(4))
			router.use(saw)

			Utils.request(server)
				.get('/foo')
				.expect(Utils.shouldNotHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(Utils.shouldNotHitHandle(3))
				.expect(Utils.shouldNotHitHandle(4))
				.expect(200, 'saw undefined /foo', done)
		})

		it('should stack', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const route = router.route('/foo')
			const server = Utils.createServer(router)

			route.post(Utils.createHitHandle(1))
			route.all(Utils.createHitHandle(2))
			route.get(Utils.createHitHandle(3))

			router.use(saw)

			Utils.request(server)
				.get('/foo')
				.expect('x-fn-2', 'hit')
				.expect('x-fn-3', 'hit')
				.expect(200, 'saw GET /foo', cb)

			Utils.request(server)
				.post('/foo')
				.expect('x-fn-1', 'hit')
				.expect('x-fn-2', 'hit')
				.expect(200, 'saw POST /foo', cb)

			Utils.request(server).put('/foo').expect('x-fn-2', 'hit').expect(200, 'saw PUT /foo', cb)
		})

		it('should not error on empty route', (_, done) => {
			const cb = Utils.after(2, done)
			const router = new Router()
			const _route = router.route('/foo')
			const server = Utils.createServer(router)

			Utils.request(server).get('/foo').expect(404, cb)

			Utils.request(server).head('/foo').expect(404, cb)
		})

		it('should not invoke singular error route', (_, done) => {
			const router = new Router()
			const route = router.route('/foo')
			const server = Utils.createServer(router)

			route.all((_err, _req, _res, _next) => {
				throw new Error('boom!')
			})

			Utils.request(server).get('/foo').expect(404, done)
		})

		it('should not stack overflow with a large sync stack', { timeout: 5000 }, (_, done) => {
			const router = new Router()
			const route = router.route('/foo')
			const server = Utils.createServer(router)

			for (let i = 0; i < 6000; i++) {
				route.all((_req, _res, next) => {
					next()
				})
			}

			route.get(helloWorld)

			Utils.request(server).get('/foo').expect(200, 'hello, world', done)
		})

		describe('.all(...fn)', () => {
			it('should reject no arguments', () => {
				const router = new Router()
				const route = router.route('/')
				Utils.assert.throws(route.all.bind(route), /argument handler is required/)
			})

			it('should reject empty array', () => {
				const router = new Router()
				const route = router.route('/')
				Utils.assert.throws(route.all.bind(route, []), /argument handler is required/)
			})

			it('should reject invalid fn', () => {
				const router = new Router()
				const route = router.route('/')
				Utils.assert.throws(route.all.bind(route, 2), /argument handler must be a function/)
			})

			it('should respond to all methods', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

				Utils.request(server).post('/foo').expect(200, 'saw POST /foo', cb)

				Utils.request(server).put('/foo').expect(200, 'saw PUT /foo', cb)
			})

			it('should accept multiple arguments', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld)

				Utils.request(server)
					.get('/foo')
					.expect('x-fn-1', 'hit')
					.expect('x-fn-2', 'hit')
					.expect(200, 'hello, world', done)
			})

			it('should accept single array of handlers', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all([Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld])

				Utils.request(server)
					.get('/foo')
					.expect('x-fn-1', 'hit')
					.expect('x-fn-2', 'hit')
					.expect(200, 'hello, world', done)
			})

			it('should accept nested arrays of handlers', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(
					[[Utils.createHitHandle(1), Utils.createHitHandle(2)], Utils.createHitHandle(3)],
					helloWorld,
				)

				Utils.request(server)
					.get('/foo')
					.expect('x-fn-1', 'hit')
					.expect('x-fn-2', 'hit')
					.expect('x-fn-3', 'hit')
					.expect(200, 'hello, world', done)
			})
		})

		// biome-ignore lint/complexity/noForEach: <explanation>
		methods
			.slice()
			.sort()
			.forEach((method) => {
				if (method === 'connect') {
					// CONNECT is tricky and supertest doesn't support it
					return
				}

				const body =
					method !== 'head'
						? Utils.shouldHaveBody(Buffer.from('hello, world')) //
						: Utils.shouldNotHaveBody()

				describe(`.${method}(...fn)`, () => {
					it(`should respond to a ${method.toUpperCase()} request`, (_, done) => {
						const router = new Router()
						const route = router.route('/')
						const server = Utils.createServer(router)

						route[method](helloWorld)

						Utils.request(server)[method]('/').expect(200).expect(body).end(done)
					})

					it('should reject no arguments', () => {
						const router = new Router()
						const route = router.route('/')
						Utils.assert.throws(route[method].bind(route), /argument handler is required/)
					})

					it('should reject empty array', () => {
						const router = new Router()
						const route = router.route('/')
						Utils.assert.throws(route[method].bind(route, []), /argument handler is required/)
					})

					it('should reject invalid fn', () => {
						const router = new Router()
						const route = router.route('/')
						Utils.assert.throws(route[method].bind(route, 2), /argument handler must be a function/)
					})

					it('should accept multiple arguments', (_, done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = Utils.createServer(router)

						route[method](Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld)

						Utils.request(server)
							[method]('/foo')
							.expect(200)
							.expect('x-fn-1', 'hit')
							.expect('x-fn-2', 'hit')
							.expect(body)
							.end(done)
					})

					it('should accept single array of handlers', (_, done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = Utils.createServer(router)

						route[method]([Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld])

						Utils.request(server)
							[method]('/foo')
							.expect(200)
							.expect('x-fn-1', 'hit')
							.expect('x-fn-2', 'hit')
							.expect(body)
							.end(done)
					})

					it('should accept nested arrays of handlers', (_, done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = Utils.createServer(router)

						route[method](
							[[Utils.createHitHandle(1), Utils.createHitHandle(2)], Utils.createHitHandle(3)],
							helloWorld,
						)

						Utils.request(server)
							[method]('/foo')
							.expect(200)
							.expect('x-fn-1', 'hit')
							.expect('x-fn-2', 'hit')
							.expect('x-fn-3', 'hit')
							.expect(body)
							.end(done)
					})
				})
			})

		describe('error handling', () => {
			it('should handle errors from next(err)', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(function createError(_req, _res, next) {
					next(new Error('boom!'))
				})

				route.all(helloWorld)

				route.all((err, _req, res, _next) => {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				Utils.request(server).get('/foo').expect(500, 'caught: boom!', done)
			})

			it('should handle errors thrown', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(function createError(_req, _res, _next) {
					throw new Error('boom!')
				})

				route.all(helloWorld)

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				Utils.request(server).get('/foo').expect(500, 'caught: boom!', done)
			})

			it('should handle errors thrown in error handlers', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(function createError(_req, _res, _next) {
					throw new Error('boom!')
				})

				route.all(function handleError(_err, _req, _res, _next) {
					throw new Error('oh, no!')
				})

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				Utils.request(server).get('/foo').expect(500, 'caught: oh, no!', done)
			})
		})

		describe('next("route")', () => {
			it('should invoke next handler', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.get((_req, res, next) => {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.use(saw)

				Utils.request(server)
					.get('/foo')
					.expect('x-next', 'route')
					.expect(200, 'saw GET /foo', done)
			})

			it('should invoke next route', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.get((_req, res, next) => {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.route('/foo').all(saw)

				Utils.request(server)
					.get('/foo')
					.expect('x-next', 'route')
					.expect(200, 'saw GET /foo', done)
			})

			it('should skip next handlers in route', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(Utils.createHitHandle(1))
				route.get(function goNext(_req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})
				route.all(Utils.createHitHandle(2))

				router.use(saw)

				Utils.request(server)
					.get('/foo')
					.expect(Utils.shouldHitHandle(1))
					.expect('x-next', 'route')
					.expect(Utils.shouldNotHitHandle(2))
					.expect(200, 'saw GET /foo', done)
			})

			it('should not invoke error handlers', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(function goNext(_req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				Utils.request(server).get('/foo').expect('x-next', 'route').expect(404, done)
			})
		})

		describe('next("router")', () => {
			it('should exit the router', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				function handle(_req, res, next) {
					res.setHeader('x-next', 'router')
					next('router')
				}

				route.get(handle, Utils.createHitHandle(1))

				router.use(saw)

				Utils.request(server)
					.get('/foo')
					.expect('x-next', 'router')
					.expect(Utils.shouldNotHitHandle(1))
					.expect(404, done)
			})

			it('should not invoke error handlers', (_, done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = Utils.createServer(router)

				route.all(function goNext(_req, res, next) {
					res.setHeader('x-next', 'router')
					next('router')
				})

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				router.use(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				Utils.request(server).get('/foo').expect('x-next', 'router').expect(404, done)
			})
		})

		describe('path', () => {
			describe('using ":name"', () => {
				it('should name a capture group', (_, done) => {
					const router = new Router()
					const route = router.route('/:foo')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/bar').expect(200, { foo: 'bar' }, done)
				})

				it('should match single path segment', (_, done) => {
					const router = new Router()
					const route = router.route('/:foo')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/bar/bar').expect(404, done)
				})

				it('should work multiple times', (_, done) => {
					const router = new Router()
					const route = router.route('/:foo/:bar')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/fizz/buzz').expect(200, { foo: 'fizz', bar: 'buzz' }, done)
				})

				it('should work following a partial capture group', (_, done) => {
					const cb = Utils.after(2, done)
					const router = new Router()
					const route = router.route('/user(s)?/:user/:op')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/user/tj/edit').expect(200, { user: 'tj', op: 'edit' }, cb)

					Utils.request(server)
						.get('/users/tj/edit')
						.expect(200, { '0': 's', user: 'tj', op: 'edit' }, cb)
				})

				it('should work inside literal parentheses', (_, done) => {
					const router = new Router()
					const route = router.route('/:user\\(:op\\)')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/tj(edit)').expect(200, { user: 'tj', op: 'edit' }, done)
				})

				it('should work within arrays', (_, done) => {
					const cb = Utils.after(2, done)
					const router = new Router()
					const route = router.route(['/user/:user/poke', '/user/:user/pokes'])
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/user/tj/poke').expect(200, { user: 'tj' }, cb)

					Utils.request(server).get('/user/tj/pokes').expect(200, { user: 'tj' }, cb)
				})
			})

			describe('using "*"', () => {
				it('should capture everything', (_, done) => {
					const router = new Router()
					const route = router.route('*')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo/bar/baz').expect(200, { '0': '/foo/bar/baz' }, done)
				})

				it('should decode the capture', (_, done) => {
					const router = new Router()
					const route = router.route('*')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo/%20/baz').expect(200, { '0': '/foo/ /baz' }, done)
				})

				it('should capture everything with pre- and post-fixes', (_, done) => {
					const router = new Router()
					const route = router.route('/foo/*/bar')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo/1/2/3/bar').expect(200, { '0': '1/2/3' }, done)
				})

				it('should capture greedly', (_, done) => {
					const router = new Router()
					const route = router.route('/foo/*/bar')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo/bar/bar/bar').expect(200, { '0': 'bar/bar' }, done)
				})

				it('should be an optional capture', (_, done) => {
					const router = new Router()
					const route = router.route('/foo*')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo').expect(200, { '0': '' }, done)
				})

				it('should require preceeding /', (_, done) => {
					const cb = Utils.after(2, done)
					const router = new Router()
					const route = router.route('/foo/*')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/foo').expect(404, cb)

					Utils.request(server).get('/foo/').expect(200, cb)
				})

				it('should work in a named parameter', (_, done) => {
					const cb = Utils.after(2, done)
					const router = new Router()
					const route = router.route('/:foo(*)')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/bar').expect(200, { '0': 'bar', foo: 'bar' }, cb)

					Utils.request(server)
						.get('/fizz/buzz')
						.expect(200, { '0': 'fizz/buzz', foo: 'fizz/buzz' }, cb)
				})

				it('should work before a named parameter', (_, done) => {
					const router = new Router()
					const route = router.route('/*/user/:id')
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/poke/user/42').expect(200, { '0': 'poke', id: '42' }, done)
				})

				it('should work within arrays', (_, done) => {
					const cb = Utils.after(3, done)
					const router = new Router()
					const route = router.route(['/user/:id', '/foo/*', '/:action'])
					const server = Utils.createServer(router)

					route.all(sendParams)

					Utils.request(server).get('/user/42').expect(200, { id: '42' }, cb)

					Utils.request(server).get('/foo/bar').expect(200, { '0': 'bar' }, cb)

					Utils.request(server).get('/poke').expect(200, { action: 'poke' }, cb)
				})
			})
		})
	})
})

function helloWorld(_req: Types.RoutedRequest, res: Types.ServerResponse): void {
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end('hello, world')
}

function _setsaw(num: number): Types.RouteHandler {
	const name = `x-saw-${String(num)}`
	return function hit({ method, url }, res, next) {
		res.setHeader(name, `${method} ${url}`)
		next()
	}
}

function saw({ method, url }: Types.RoutedRequest, res: Types.ServerResponse): void {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sendParams(req: Types.RoutedRequest, res: Types.ServerResponse): void {
	res.statusCode = 200
	res.setHeader('Content-Type', 'application/json')
	res.end(JSON.stringify(req.params))
}
