import { describe, it } from 'node:test'
import { Buffer } from 'safe-buffer'

import { methods } from '../src/methods'
import Router from '../src/router'
import type * as Types from '../src/types'
import * as Utils from './support/utils'

describe('Router', () => {
	// it('should return a function', () => {
	// 	Utils.assert.equal(typeof Router(), 'function')
	// })

	it('should return a function using new', () => {
		Utils.assert.equal(typeof new Router(), 'function')
	})

	it('should reject missing callback', () => {
		const router = new Router()
		Utils.assert.throws(() => {
			// @ts-expect-error
			router.handle({}, {})
		}, /argument callback is required/)
	})

	it.only('should invoke callback without "req.url"', (_, done) => {
		const router = new Router()
		router.use(saw)
		router.handle({}, {}, done)
	})

	describe('.all(path, fn)', () => {
		it('should be chainable', () => {
			const router = new Router()
			Utils.assert.equal(router.all('/', helloWorld), router)
		})

		it('should respond to all methods', (_, done) => {
			const cb = Utils.after(methods.length, done)
			const router = new Router()
			const server = Utils.createServer(router)
			router.all('/', helloWorld)

			for (const method of methods) {
				if (method === 'connect') {
					// CONNECT is tricky and supertest doesn't support it
					cb()
				}

				const body =
					method !== 'head'
						? Utils.shouldHaveBody(Buffer.from('hello, world'))
						: Utils.shouldNotHaveBody()

				Utils.request(server)[method]('/').expect(200).expect(body).end(cb)
			}
		})

		it('should support array of paths', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.all(['/foo', '/bar'], saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

			Utils.request(server).get('/bar').expect(200, 'saw GET /bar', cb)
		})

		it('should support regexp path', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.all(/^\/[a-z]oo$/, saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

			Utils.request(server).get('/zoo').expect(200, 'saw GET /zoo', cb)
		})

		it('should support parameterized path', (_, done) => {
			const cb = Utils.after(4, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.all('/:thing', saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

			Utils.request(server).get('/bar').expect(200, 'saw GET /bar', cb)

			Utils.request(server).get('/foo/bar').expect(404, cb)
		})

		it('should not stack overflow with many registered routes', { timeout: 5000 }, (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			for (let i = 0; i < 6000; i++) {
				router.get(`/thing${i}`, helloWorld)
			}

			router.get('/', helloWorld)

			Utils.request(server).get('/').expect(200, 'hello, world', done)
		})

		it('should not stack overflow with a large sync stack', { timeout: 5000 }, (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			for (let i = 0; i < 6000; i++) {
				router.get('/foo', (_req, _res, next) => {
					next()
				})
			}

			router.get('/foo', helloWorld)

			Utils.request(server).get('/foo').expect(200, 'hello, world', done)
		})

		describe('with "caseSensitive" option', () => {
			it('should not match paths case-sensitively by default', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router()
				const server = Utils.createServer(router)

				router.all('/foo/bar', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /foo/bar', cb)

				Utils.request(server).get('/FOO/bar').expect(200, 'saw GET /FOO/bar', cb)

				Utils.request(server).get('/FOO/BAR').expect(200, 'saw GET /FOO/BAR', cb)
			})

			it('should not match paths case-sensitively when false', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router({ caseSensitive: false })
				const server = Utils.createServer(router)

				router.all('/foo/bar', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /foo/bar', cb)

				Utils.request(server).get('/FOO/bar').expect(200, 'saw GET /FOO/bar', cb)

				Utils.request(server).get('/FOO/BAR').expect(200, 'saw GET /FOO/BAR', cb)
			})

			it('should match paths case-sensitively when true', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router({ caseSensitive: true })
				const server = Utils.createServer(router)

				router.all('/foo/bar', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /foo/bar', cb)

				Utils.request(server).get('/FOO/bar').expect(404, cb)

				Utils.request(server).get('/FOO/BAR').expect(404, cb)
			})
		})

		describe('with "strict" option', () => {
			it('should accept optional trailing slashes by default', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router()
				const server = Utils.createServer(router)

				router.all('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

				Utils.request(server).get('/foo/').expect(200, 'saw GET /foo/', cb)
			})

			it('should accept optional trailing slashes when false', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router({ strict: false })
				const server = Utils.createServer(router)

				router.all('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

				Utils.request(server).get('/foo/').expect(200, 'saw GET /foo/', cb)
			})

			it('should not accept optional trailing slashes when true', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router({ strict: true })
				const server = Utils.createServer(router)

				router.all('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /foo', cb)

				Utils.request(server).get('/foo/').expect(404, cb)
			})
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

			describe(`.${method}(path, ...fn)`, () => {
				it('should be chainable', () => {
					const router = new Router()
					Utils.assert.equal(router[method]('/', helloWorld), router)
				})

				it(`should respond to a ${method.toUpperCase()} request`, (_, done) => {
					const router = new Router()
					const server = Utils.createServer(router)

					router[method]('/', helloWorld)

					Utils.request(server)[method]('/').expect(200).expect(body).end(done)
				})

				it('should reject invalid fn', () => {
					const router = new Router()
					Utils.assert.throws(
						router[method].bind(router, '/', 2),
						/argument handler must be a function/,
					)
				})

				it('should support array of paths', (_, done) => {
					const cb = Utils.after(3, done)
					const router = new Router()
					const server = Utils.createServer(router)

					router[method](['/foo', '/bar'], Utils.createHitHandle(1), helloWorld)

					Utils.request(server)[method]('/').expect(404).expect(Utils.shouldNotHitHandle(1)).end(cb)

					Utils.request(server)
						[method]('/foo')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)

					Utils.request(server)
						[method]('/bar')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)
				})

				it('should support regexp path', (_, done) => {
					const cb = Utils.after(3, done)
					const router = new Router()
					const server = Utils.createServer(router)

					router[method](/^\/[a-z]oo$/, Utils.createHitHandle(1), helloWorld)

					Utils.request(server)[method]('/').expect(404).expect(Utils.shouldNotHitHandle(1)).end(cb)

					Utils.request(server)
						[method]('/foo')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)

					Utils.request(server)
						[method]('/zoo')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)
				})

				it('should support parameterized path', (_, done) => {
					const cb = Utils.after(4, done)
					const router = new Router()
					const server = Utils.createServer(router)

					router[method]('/:thing', Utils.createHitHandle(1), helloWorld)

					Utils.request(server)[method]('/').expect(404).expect(Utils.shouldNotHitHandle(1)).end(cb)

					Utils.request(server)
						[method]('/foo')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)

					Utils.request(server)
						[method]('/bar')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(body)
						.end(cb)

					Utils.request(server)
						[method]('/foo/bar')
						.expect(404)
						.expect(Utils.shouldNotHitHandle(1))
						.end(cb)
				})

				it('should accept multiple arguments', (_, done) => {
					const router = new Router()
					const server = Utils.createServer(router)

					router[method]('/', Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld)

					Utils.request(server)
						[method]('/')
						.expect(200)
						.expect(Utils.shouldHitHandle(1))
						.expect(Utils.shouldHitHandle(2))
						.expect(body)
						.end(done)
				})

				describe('req.baseUrl', () => {
					it('should be empty', (_, done) => {
						const router = new Router()
						const server = Utils.createServer(router)

						router[method]('/foo', function handle(req, res) {
							res.setHeader('x-url-base', JSON.stringify(req.baseUrl))
							res.end()
						})

						Utils.request(server)[method]('/foo').expect('x-url-base', '""').expect(200, done)
					})
				})

				describe('req.route', () => {
					it('should be a Route', (_, done) => {
						const router = new Router()
						const server = Utils.createServer(router)

						router[method]('/foo', function handle(req, res) {
							res.setHeader('x-is-route', String(req.route instanceof Router.Route))
							res.end()
						})

						Utils.request(server)[method]('/foo').expect('x-is-route', 'true').expect(200, done)
					})

					it('should be the matched route', (_, done) => {
						const router = new Router()
						const server = Utils.createServer(router)

						router[method]('/foo', function handle(req, res) {
							res.setHeader('x-is-route', String(req.route.path === '/foo'))
							res.end()
						})

						Utils.request(server)[method]('/foo').expect('x-is-route', 'true').expect(200, done)
					})
				})
			})
		})

	describe('.use(...fn)', () => {
		it('should reject missing functions', () => {
			const router = new Router()
			Utils.assert.throws(router.use.bind(router), /argument handler is required/)
		})

		it('should reject empty array', () => {
			const router = new Router()
			Utils.assert.throws(router.use.bind(router, []), /argument handler is required/)
		})

		it('should reject non-functions', () => {
			const router = new Router()
			Utils.assert.throws(
				router.use.bind(router, '/', 'hello'),
				/argument handler must be a function/,
			)
			Utils.assert.throws(router.use.bind(router, '/', 5), /argument handler must be a function/)
			Utils.assert.throws(router.use.bind(router, '/', null), /argument handler must be a function/)
			Utils.assert.throws(
				router.use.bind(router, '/', new Date()),
				/argument handler must be a function/,
			)
		})

		it('should be chainable', () => {
			const router = new Router()
			Utils.assert.equal(router.use(helloWorld), router)
		})

		it('should invoke function for all requests', (_, done) => {
			const cb = Utils.after(4, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(saw)

			Utils.request(server).get('/').expect(200, 'saw GET /', cb)

			Utils.request(server).put('/').expect(200, 'saw PUT /', cb)

			Utils.request(server).post('/foo').expect(200, 'saw POST /foo', cb)

			Utils.rawrequest(server).options('*').expect(200, 'saw OPTIONS *', cb)
		})

		it('should not invoke for blank URLs', (_, done) => {
			const router = new Router()
			const server = Utils.createServer((req, res, next) => {
				req.url = ''
				router.handle(req, res, next)
			})

			router.use(saw)

			Utils.request(server).get('/').expect(404, done)
		})

		it('should support another router', (_, done) => {
			const inner = new Router()
			const router = new Router()
			const server = Utils.createServer(router)

			inner.use(saw)
			router.use(inner)

			Utils.request(server).get('/').expect(200, 'saw GET /', done)
		})

		it('should accept multiple arguments', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld)

			Utils.request(server)
				.get('/')
				.expect(Utils.shouldHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(200, 'hello, world', done)
		})

		it('should accept single array of middleware', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use([Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld])

			Utils.request(server)
				.get('/')
				.expect(Utils.shouldHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(200, 'hello, world', done)
		})

		it('should accept nested arrays of middleware', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(
				[[Utils.createHitHandle(1), Utils.createHitHandle(2)], Utils.createHitHandle(3)],
				helloWorld,
			)

			Utils.request(server)
				.get('/')
				.expect(Utils.shouldHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(Utils.shouldHitHandle(3))
				.expect(200, 'hello, world', done)
		})

		it('should not invoke singular error function', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use((err, req, res, next) => {
				throw new Error('boom!')
			})

			Utils.request(server).get('/').expect(404, done)
		})

		it('should not stack overflow with a large sync stack', { timeout: 5000 }, (_, done): void => {
			const router = new Router()
			const server = Utils.createServer(router)

			for (let i = 0; i < 6000; i++) {
				router.use((_req, _res, next) => {
					next()
				})
			}

			router.use(helloWorld)

			Utils.request(server).get('/').expect(200, 'hello, world', done)
		})

		describe('error handling', () => {
			it('should invoke error function after next(err)', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use((req, res, next) => {
					next(new Error('boom!'))
				})

				router.use(sawError)

				Utils.request(server).get('/').expect(200, 'saw Error: boom!', done)
			})

			it('should invoke error function after throw err', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use(function handle(req, res, next) {
					throw new Error('boom!')
				})

				router.use(sawError)

				Utils.request(server).get('/').expect(200, 'saw Error: boom!', done)
			})

			it('should not invoke error functions above function', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use(sawError)

				router.use((req, res, next) => {
					throw new Error('boom!')
				})

				Utils.request(server).get('/').expect(500, done)
			})
		})

		describe('next("route")', () => {
			it('should invoke next handler', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use(function handle(req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.use(saw)

				Utils.request(server).get('/').expect('x-next', 'route').expect(200, 'saw GET /', done)
			})

			it('should invoke next function', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				function goNext(req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				}

				router.use(Utils.createHitHandle(1), goNext, Utils.createHitHandle(2), saw)

				Utils.request(server)
					.get('/')
					.expect(Utils.shouldHitHandle(1))
					.expect('x-next', 'route')
					.expect(Utils.shouldHitHandle(2))
					.expect(200, 'saw GET /', done)
			})

			it('should not invoke error handlers', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use((_, res, next) => {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.use(sawError)

				Utils.request(server).get('/').expect('x-next', 'route').expect(404, done)
			})
		})

		describe('next("router")', () => {
			it('should exit the router', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				function handle(req, res, next) {
					res.setHeader('x-next', 'router')
					next('router')
				}

				router.use(handle, Utils.createHitHandle(1))
				router.use(saw)

				Utils.request(server)
					.get('/')
					.expect('x-next', 'router')
					.expect(Utils.shouldNotHitHandle(1))
					.expect(404, done)
			})

			it('should not invoke error handlers', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use((_, res, next) => {
					res.setHeader('x-next', 'router')
					next('route')
				})

				router.use(sawError)

				Utils.request(server).get('/').expect('x-next', 'router').expect(404, done)
			})
		})

		describe('req.baseUrl', () => {
			it('should be empty', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use(sawBase)

				Utils.request(server).get('/foo/bar').expect(200, 'saw ', done)
			})
		})
	})

	describe('.use(path, ...fn)', () => {
		it('should be chainable', () => {
			const router = new Router()
			Utils.assert.equal(router.use('/', helloWorld), router)
		})

		it('should invoke when req.url starts with path', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use('/foo', saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).post('/foo').expect(200, 'saw POST /', cb)

			Utils.request(server).post('/foo/bar').expect(200, 'saw POST /bar', cb)
		})

		it('should match if path has trailing slash', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use('/foo/', saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).post('/foo').expect(200, 'saw POST /', cb)

			Utils.request(server).post('/foo/bar').expect(200, 'saw POST /bar', cb)
		})

		it('should support array of paths', (_, done) => {
			const cb = Utils.after(3, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(['/foo/', '/bar'], saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

			Utils.request(server).get('/bar').expect(200, 'saw GET /', cb)
		})

		it('should support regexp path', (_, done) => {
			const cb = Utils.after(5, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(/^\/[a-z]oo/, saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

			Utils.request(server).get('/fooo').expect(404, cb)

			Utils.request(server).get('/zoo/bear').expect(200, 'saw GET /bear', cb)

			Utils.request(server).get('/get/zoo').expect(404, cb)
		})

		it('should ensure regexp matches path prefix', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use(/\/api.*/, Utils.createHitHandle(1))
			router.use(/api/, Utils.createHitHandle(2))
			router.use(/\/test/, Utils.createHitHandle(3))
			router.use(helloWorld)

			Utils.request(server)
				.get('/test/api/1234')
				.expect(Utils.shouldNotHitHandle(1))
				.expect(Utils.shouldNotHitHandle(2))
				.expect(Utils.shouldHitHandle(3))
				.expect(200, done)
		})

		it('should support parameterized path', (_, done) => {
			const cb = Utils.after(4, done)
			const router = new Router()
			const server = Utils.createServer(router)

			router.use('/:thing', saw)

			Utils.request(server).get('/').expect(404, cb)

			Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

			Utils.request(server).get('/bar').expect(200, 'saw GET /', cb)

			Utils.request(server).get('/foo/bar').expect(200, 'saw GET /bar', cb)
		})

		it('should accept multiple arguments', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.use('/foo', Utils.createHitHandle(1), Utils.createHitHandle(2), helloWorld)

			Utils.request(server)
				.get('/foo')
				.expect(Utils.shouldHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(200, 'hello, world', done)
		})

		describe('with "caseSensitive" option', () => {
			it('should not match paths case-sensitively by default', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /bar', cb)

				Utils.request(server).get('/FOO/bar').expect(200, 'saw GET /bar', cb)

				Utils.request(server).get('/FOO/BAR').expect(200, 'saw GET /BAR', cb)
			})

			it('should not match paths case-sensitively when false', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router({ caseSensitive: false })
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /bar', cb)

				Utils.request(server).get('/FOO/bar').expect(200, 'saw GET /bar', cb)

				Utils.request(server).get('/FOO/BAR').expect(200, 'saw GET /BAR', cb)
			})

			it('should match paths case-sensitively when true', (_, done) => {
				const cb = Utils.after(3, done)
				const router = new Router({ caseSensitive: true })
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /bar', cb)

				Utils.request(server).get('/FOO/bar').expect(404, cb)

				Utils.request(server).get('/FOO/BAR').expect(404, cb)
			})
		})

		describe('with "strict" option', () => {
			it('should accept optional trailing slashes by default', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

				Utils.request(server).get('/foo/').expect(200, 'saw GET /', cb)
			})

			it('should accept optional trailing slashes when false', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router({ strict: false })
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

				Utils.request(server).get('/foo/').expect(200, 'saw GET /', cb)
			})

			it('should accept optional trailing slashes when true', (_, done) => {
				const cb = Utils.after(2, done)
				const router = new Router({ strict: true })
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo').expect(200, 'saw GET /', cb)

				Utils.request(server).get('/foo/').expect(200, 'saw GET /', cb)
			})
		})

		describe('next("route")', () => {
			it('should invoke next handler', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', function handle(req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				})

				router.use('/foo', saw)

				Utils.request(server).get('/foo').expect('x-next', 'route').expect(200, 'saw GET /', done)
			})

			it('should invoke next function', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				function goNext(req, res, next) {
					res.setHeader('x-next', 'route')
					next('route')
				}

				router.use('/foo', Utils.createHitHandle(1), goNext, Utils.createHitHandle(2), saw)

				Utils.request(server)
					.get('/foo')
					.expect(Utils.shouldHitHandle(1))
					.expect('x-next', 'route')
					.expect(Utils.shouldHitHandle(2))
					.expect(200, 'saw GET /', done)
			})
		})

		describe('req.baseUrl', () => {
			it('should contain the stripped path', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', sawBase)

				Utils.request(server).get('/foo/bar').expect(200, 'saw /foo', done)
			})

			it('should contain the stripped path for multiple levels', (_, done) => {
				const router1 = new Router()
				const router2 = new Router()
				const server = Utils.createServer(router1)

				router1.use('/foo', router2)
				router2.use('/bar', sawBase)

				Utils.request(server).get('/foo/bar/baz').expect(200, 'saw /foo/bar', done)
			})

			it('should be altered correctly', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)
				const sub1 = new Router()
				const sub2 = new Router()
				const sub3 = new Router()

				sub3.get('/zed', setsawBase(1))

				sub2.use('/baz', sub3)

				sub1.use('/', setsawBase(2))

				sub1.use('/bar', sub2)
				sub1.use('/bar', setsawBase(3))

				router.use(setsawBase(4))
				router.use('/foo', sub1)
				router.use(setsawBase(5))
				router.use(helloWorld)

				Utils.request(server)
					.get('/foo/bar/baz/zed')
					.expect('x-saw-base-1', '/foo/bar/baz')
					.expect('x-saw-base-2', '/foo')
					.expect('x-saw-base-3', '/foo/bar')
					.expect('x-saw-base-4', '')
					.expect('x-saw-base-5', '')
					.expect(200, done)
			})
		})

		describe('req.url', () => {
			it('should strip path from req.url', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', saw)

				Utils.request(server).get('/foo/bar').expect(200, 'saw GET /bar', done)
			})

			it('should restore req.url after stripping', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', setsaw(1))
				router.use(saw)

				Utils.request(server)
					.get('/foo/bar')
					.expect('x-saw-1', 'GET /bar')
					.expect(200, 'saw GET /foo/bar', done)
			})

			it('should strip/restore with trailing stash', (_, done) => {
				const router = new Router()
				const server = Utils.createServer(router)

				router.use('/foo', setsaw(1))
				router.use(saw)

				Utils.request(server)
					.get('/foo/')
					.expect('x-saw-1', 'GET /')
					.expect(200, 'saw GET /foo/', done)
			})
		})
	})

	describe('request rewriting', () => {
		it('should support altering req.method', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.put('/foo', Utils.createHitHandle(1))
			router.post('/foo', Utils.createHitHandle(2), (req, _, next) => {
				req.method = 'PUT'
				next()
			})

			router.post('/foo', Utils.createHitHandle(3))
			router.put('/foo', Utils.createHitHandle(4))
			router.use(saw)

			Utils.request(server)
				.post('/foo')
				.expect(Utils.shouldNotHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(Utils.shouldNotHitHandle(3))
				.expect(Utils.shouldHitHandle(4))
				.expect(200, 'saw PUT /foo', done)
		})

		it('should support altering req.url', (_, done) => {
			const router = new Router()
			const server = Utils.createServer(router)

			router.get('/bar', Utils.createHitHandle(1))
			router.get('/foo', Utils.createHitHandle(2), (req, _, next) => {
				req.url = '/bar'
				next()
			})

			router.get('/foo', Utils.createHitHandle(3))
			router.get('/bar', Utils.createHitHandle(4))
			router.use(saw)

			Utils.request(server)
				.get('/foo')
				.expect(Utils.shouldNotHitHandle(1))
				.expect(Utils.shouldHitHandle(2))
				.expect(Utils.shouldNotHitHandle(3))
				.expect(Utils.shouldHitHandle(4))
				.expect(200, 'saw GET /bar', done)
		})
	})
})

function helloWorld(req, res): void {
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end('hello, world')
}

function setsaw(num: number): (req, res, next) => void {
	const name = `x-saw-${String(num)}`
	return function saw(req, res, next) {
		res.setHeader(name, `${req.method} ${req.url}`)
		next()
	}
}

function setsawBase(num: number): (req, res, next) => void {
	const name = `x-saw-base-${String(num)}`
	return function sawBase(req, res, next) {
		res.setHeader(name, String(req.baseUrl))
		next()
	}
}

function saw(req: Types.RoutedRequest, res: Types.OutgoingMessage): void {
	const msg = `saw ${req.method} ${req.url}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sawError(
	err: any,
	_req: Types.IncomingRequest,
	res: Types.OutgoingMessage,
	_next: Types.NextFunction,
): void {
	const msg = `saw ${err.name}: ${err.message}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}

function sawBase(req, res): void {
	const msg = `saw ${req.baseUrl}`
	res.statusCode = 200
	res.setHeader('Content-Type', 'text/plain')
	res.end(msg)
}
