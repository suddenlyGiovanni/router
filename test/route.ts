import { after, describe, it } from 'node:test'
import { Buffer } from 'safe-buffer'
import { methods } from '../src/methods'
import Router from '../src/router'
import {
	assert,
	createHitHandle,
	createServer,
	request,
	shouldHaveBody,
	shouldHitHandle,
	shouldNotHaveBody,
	shouldNotHitHandle,
} from './support/utils'

describe('Router', () => {
	describe('.route(path)', () => {
		it('should return a new route', () => {
			const router = new Router()
			const route = router.route('/foo')
			assert.equal(route.path, '/foo')
		})

		it('should respond to multiple methods', (done) => {
			const cb = after(3, done)
			const router = new Router()
			const route = router.route('/foo')
			const server = createServer(router)

			route.get(saw)
			route.post(saw)

			request(server).get('/foo').expect(200, 'saw GET /foo', cb)

			request(server).post('/foo').expect(200, 'saw POST /foo', cb)

			request(server).put('/foo').expect(404, cb)
		})

		it('should route without method', (done) => {
			const router = new Router()
			const route = router.route('/foo')
			const server = createServer((req, res, next) => {
				req.method = undefined
				router(req, res, next)
			})

			route.post(createHitHandle(1))
			route.all(createHitHandle(2))
			route.get(createHitHandle(3))

			router.get('/foo', createHitHandle(4))
			router.use(saw)

			request(server)
				.get('/foo')
				.expect(shouldNotHitHandle(1))
				.expect(shouldHitHandle(2))
				.expect(shouldNotHitHandle(3))
				.expect(shouldNotHitHandle(4))
				.expect(200, 'saw undefined /foo', done)
		})

		it('should stack', (done) => {
			const cb = after(3, done)
			const router = new Router()
			const route = router.route('/foo')
			const server = createServer(router)

			route.post(createHitHandle(1))
			route.all(createHitHandle(2))
			route.get(createHitHandle(3))

			router.use(saw)

			request(server)
				.get('/foo')
				.expect('x-fn-2', 'hit')
				.expect('x-fn-3', 'hit')
				.expect(200, 'saw GET /foo', cb)

			request(server)
				.post('/foo')
				.expect('x-fn-1', 'hit')
				.expect('x-fn-2', 'hit')
				.expect(200, 'saw POST /foo', cb)

			request(server).put('/foo').expect('x-fn-2', 'hit').expect(200, 'saw PUT /foo', cb)
		})

		it('should not error on empty route', (done) => {
			const cb = after(2, done)
			const router = new Router()
			const route = router.route('/foo')
			const server = createServer(router)

			request(server).get('/foo').expect(404, cb)

			request(server).head('/foo').expect(404, cb)
		})

		it('should not invoke singular error route', (done) => {
			const router = new Router()
			const route = router.route('/foo')
			const server = createServer(router)

			route.all((_err, _req, _res, _next) => {
				throw new Error('boom!')
			})

			request(server).get('/foo').expect(404, done)
		})

		it('should not stack overflow with a large sync stack', function (done) {
			this.timeout(5000) // long-running test

			const router = new Router()
			const route = router.route('/foo')
			const server = createServer(router)

			for (let i = 0; i < 6000; i++) {
				route.all((_req, _res, next) => {
					next()
				})
			}

			route.get(helloWorld)

			request(server).get('/foo').expect(200, 'hello, world', done)
		})

		describe('.all(...fn)', () => {
			it('should reject no arguments', () => {
				const router = new Router()
				const route = router.route('/')
				assert.throws(route.all.bind(route), /argument handler is required/)
			})

			it('should reject empty array', () => {
				const router = new Router()
				const route = router.route('/')
				assert.throws(route.all.bind(route, []), /argument handler is required/)
			})

			it('should reject invalid fn', () => {
				const router = new Router()
				const route = router.route('/')
				assert.throws(route.all.bind(route, 2), /argument handler must be a function/)
			})

			it('should respond to all methods', (done) => {
				const cb = after(3, done)
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(saw)

				request(server).get('/foo').expect(200, 'saw GET /foo', cb)

				request(server).post('/foo').expect(200, 'saw POST /foo', cb)

				request(server).put('/foo').expect(200, 'saw PUT /foo', cb)
			})

			it('should accept multiple arguments', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(createHitHandle(1), createHitHandle(2), helloWorld)

				request(server)
					.get('/foo')
					.expect('x-fn-1', 'hit')
					.expect('x-fn-2', 'hit')
					.expect(200, 'hello, world', done)
			})

			it('should accept single array of handlers', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all([createHitHandle(1), createHitHandle(2), helloWorld])

				request(server)
					.get('/foo')
					.expect('x-fn-1', 'hit')
					.expect('x-fn-2', 'hit')
					.expect(200, 'hello, world', done)
			})

			it('should accept nested arrays of handlers', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all([[createHitHandle(1), createHitHandle(2)], createHitHandle(3)], helloWorld)

				request(server)
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
						? shouldHaveBody(Buffer.from('hello, world')) //
						: shouldNotHaveBody()

				describe(`.${method}(...fn)`, () => {
					it(`should respond to a ${method.toUpperCase()} request`, (done) => {
						const router = new Router()
						const route = router.route('/')
						const server = createServer(router)

						route[method](helloWorld)

						request(server)[method]('/').expect(200).expect(body).end(done)
					})

					it('should reject no arguments', () => {
						const router = new Router()
						const route = router.route('/')
						assert.throws(route[method].bind(route), /argument handler is required/)
					})

					it('should reject empty array', () => {
						const router = new Router()
						const route = router.route('/')
						assert.throws(route[method].bind(route, []), /argument handler is required/)
					})

					it('should reject invalid fn', () => {
						const router = new Router()
						const route = router.route('/')
						assert.throws(route[method].bind(route, 2), /argument handler must be a function/)
					})

					it('should accept multiple arguments', (done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = createServer(router)

						route[method](createHitHandle(1), createHitHandle(2), helloWorld)

						request(server)
							[method]('/foo')
							.expect(200)
							.expect('x-fn-1', 'hit')
							.expect('x-fn-2', 'hit')
							.expect(body)
							.end(done)
					})

					it('should accept single array of handlers', (done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = createServer(router)

						route[method]([createHitHandle(1), createHitHandle(2), helloWorld])

						request(server)
							[method]('/foo')
							.expect(200)
							.expect('x-fn-1', 'hit')
							.expect('x-fn-2', 'hit')
							.expect(body)
							.end(done)
					})

					it('should accept nested arrays of handlers', (done) => {
						const router = new Router()
						const route = router.route('/foo')
						const server = createServer(router)

						route[method](
							[[createHitHandle(1), createHitHandle(2)], createHitHandle(3)],
							helloWorld,
						)

						request(server)
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
			it('should handle errors from next(err)', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(function createError(_req, _res, next) {
					next(new Error('boom!'))
				})

				route.all(helloWorld)

				route.all((err, _req, res, _next) => {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				request(server).get('/foo').expect(500, 'caught: boom!', done)
			})

			it('should handle errors thrown', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(function createError(_req, _res, _next) {
					throw new Error('boom!')
				})

				route.all(helloWorld)

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				request(server).get('/foo').expect(500, 'caught: boom!', done)
			})

			it('should handle errors thrown in error handlers', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

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

				request(server).get('/foo').expect(500, 'caught: oh, no!', done)
			})
		})

		describe('next("route")', () => {
			it('should invoke next handler', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.get((_req, res, next) => {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.use(saw)

				request(server).get('/foo').expect('x-next', 'route').expect(200, 'saw GET /foo', done)
			})

			it('should invoke next route', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.get((_req, res, next) => {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.route('/foo').all(saw)

				request(server).get('/foo').expect('x-next', 'route').expect(200, 'saw GET /foo', done)
			})

			it('should skip next handlers in route', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(createHitHandle(1))
				route.get(function goNext(_req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})
				route.all(createHitHandle(2))

				router.use(saw)

				request(server)
					.get('/foo')
					.expect(shouldHitHandle(1))
					.expect('x-next', 'route')
					.expect(shouldNotHitHandle(2))
					.expect(200, 'saw GET /foo', done)
			})

			it('should not invoke error handlers', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(function goNext(_req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				request(server).get('/foo').expect('x-next', 'route').expect(404, done)
			})
		})

		describe('next("router")', () => {
			it('should exit the router', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				function handle(_req, res, next) {
					res.setHeader('x-next', 'router')
					next('router')
				}

				route.get(handle, createHitHandle(1))

				router.use(saw)

				request(server)
					.get('/foo')
					.expect('x-next', 'router')
					.expect(shouldNotHitHandle(1))
					.expect(404, done)
			})

			it('should not invoke error handlers', (done) => {
				const router = new Router()
				const route = router.route('/foo')
				const server = createServer(router)

				route.all(function goNext(_req, res, next) {
					res.setHeader('x-next', 'router')
					next('router')
				})

				route.all(function handleError(err, _req, res, _next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				router.use(function handleError(err, req, res, next) {
					res.statusCode = 500
					res.end(`caught: ${err.message}`)
				})

				request(server).get('/foo').expect('x-next', 'router').expect(404, done)
			})
		})

		describe('path', () => {
			describe('using ":name"', () => {
				it('should name a capture group', (done) => {
					const router = new Router()
					const route = router.route('/:foo')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/bar').expect(200, { foo: 'bar' }, done)
				})

				it('should match single path segment', (done) => {
					const router = new Router()
					const route = router.route('/:foo')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/bar/bar').expect(404, done)
				})

				it('should work multiple times', (done) => {
					const router = new Router()
					const route = router.route('/:foo/:bar')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/fizz/buzz').expect(200, { foo: 'fizz', bar: 'buzz' }, done)
				})

				it('should work following a partial capture group', (done) => {
					const cb = after(2, done)
					const router = new Router()
					const route = router.route('/user(s)?/:user/:op')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/user/tj/edit').expect(200, { user: 'tj', op: 'edit' }, cb)

					request(server)
						.get('/users/tj/edit')
						.expect(200, { '0': 's', user: 'tj', op: 'edit' }, cb)
				})

				it('should work inside literal parentheses', (done) => {
					const router = new Router()
					const route = router.route('/:user\\(:op\\)')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/tj(edit)').expect(200, { user: 'tj', op: 'edit' }, done)
				})

				it('should work within arrays', (done) => {
					const cb = after(2, done)
					const router = new Router()
					const route = router.route(['/user/:user/poke', '/user/:user/pokes'])
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/user/tj/poke').expect(200, { user: 'tj' }, cb)

					request(server).get('/user/tj/pokes').expect(200, { user: 'tj' }, cb)
				})
			})

			describe('using "*"', () => {
				it('should capture everything', (done) => {
					const router = new Router()
					const route = router.route('*')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo/bar/baz').expect(200, { '0': '/foo/bar/baz' }, done)
				})

				it('should decode the capture', (done) => {
					const router = new Router()
					const route = router.route('*')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo/%20/baz').expect(200, { '0': '/foo/ /baz' }, done)
				})

				it('should capture everything with pre- and post-fixes', (done) => {
					const router = new Router()
					const route = router.route('/foo/*/bar')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo/1/2/3/bar').expect(200, { '0': '1/2/3' }, done)
				})

				it('should capture greedly', (done) => {
					const router = new Router()
					const route = router.route('/foo/*/bar')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo/bar/bar/bar').expect(200, { '0': 'bar/bar' }, done)
				})

				it('should be an optional capture', (done) => {
					const router = new Router()
					const route = router.route('/foo*')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo').expect(200, { '0': '' }, done)
				})

				it('should require preceeding /', (done) => {
					const cb = after(2, done)
					const router = new Router()
					const route = router.route('/foo/*')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/foo').expect(404, cb)

					request(server).get('/foo/').expect(200, cb)
				})

				it('should work in a named parameter', (done) => {
					const cb = after(2, done)
					const router = new Router()
					const route = router.route('/:foo(*)')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/bar').expect(200, { '0': 'bar', foo: 'bar' }, cb)

					request(server).get('/fizz/buzz').expect(200, { '0': 'fizz/buzz', foo: 'fizz/buzz' }, cb)
				})

				it('should work before a named parameter', (done) => {
					const router = new Router()
					const route = router.route('/*/user/:id')
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/poke/user/42').expect(200, { '0': 'poke', id: '42' }, done)
				})

				it('should work within arrays', (done) => {
					const cb = after(3, done)
					const router = new Router()
					const route = router.route(['/user/:id', '/foo/*', '/:action'])
					const server = createServer(router)

					route.all(sendParams)

					request(server).get('/user/42').expect(200, { id: '42' }, cb)

					request(server).get('/foo/bar').expect(200, { '0': 'bar' }, cb)

					request(server).get('/poke').expect(200, { action: 'poke' }, cb)
				})
			})
		})
	})
})

function helloWorld(req, res) {
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end('hello, world')
}

function setsaw(num: number) {
	const name = `x-saw-${String(num)}`
	return function hit({ method, url }, res, next) {
		res.setHeader(name, `${method} ${url}`)
		next()
	}
}

function saw({ method, url }, res) {
	const msg = `saw ${method} ${url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sendParams(req, res) {
	res.statusCode = 200
	res.setHeader('Content-Type', 'application/json')
	res.end(JSON.stringify(req.params))
}
