import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

declare namespace Types {
	interface RequestHandler {
		(req: object, res: object, next: (err?: any) => void): void
	}

	interface RouterInstance {
		get: (path: string, handler: RequestHandler) => this
		handle: RequestHandler
	}

	interface RouterConstructor {
		new (): RouterInstance & RequestHandler

		(): RouterInstance & RequestHandler
	}

	const Router: RouterConstructor
}

function runRouterTests(RouterStrategy: Types.RouterConstructor) {
	it('should create a new Router instance with new', () => {
		const router = new RouterStrategy()
		assert(router instanceof RouterStrategy)
	})

	it('should create a new Router instance without new', () => {
		const router = RouterStrategy()
		assert(router instanceof RouterStrategy)
	})

	it('should be callable as a function', () => {
		const router = new RouterStrategy()
		assert(typeof router === 'function')
	})

	it('should handle requests', (_, done) => {
		const router = new RouterStrategy()
		const req = {
			url: '/test',
		}
		const res = {}
		const next = () => done()

		router.get('/test', (req, res, next) => {
			next()
		})
		router.handle(req, res, next)
	})
}

describe('api-test', () => {
	describe('function prototype', () => {
		/**
		 * Initialize a new `Router` with the given `options`.
		 *
		 * @return {Router} which is a callable function
		 */
		function Router(this: Types.RouterInstance): Types.RouterConstructor {
			if (!(this instanceof Router)) {
				return new Router()
			}

			function router(req: object, res: object, next: Function): void {
				router.handle(req, res, next)
			}

			// inherit from the correct prototype
			Object.setPrototypeOf(router, this)

			router.routes = {}
			return router
		}
		/**
		 * Router prototype inherits from a Function.
		 */
		Router.prototype = function () {}

		/**
		 * Dispatch a req, res into the router.
		 *
		 */
		Router.prototype.handle = function handle(req: object, res: object, callback: Function): void {
			console.log('handle', req, res, callback)

			callback()
		}

		runRouterTests(Router)
	})

	describe('class syntax', () => {
		class Router implements Types.RouterInstance {
			private routes: { [key: string]: Function } = {}
			constructor() {}

			// Handle GET requests
			get(path: string, handler: Types.RequestHandler): this {
				console.log('get', path, handler)
				this.routes[path] = handler
				return this
			}

			// Dispatch a req, res into the router.
			handle(req: object, res: object, next: (err?: any) => void): void {
				console.log('Handling request', req, res)
				const handler = this.routes[req?.url]
				if (handler) {
					handler(req, res, next)
				} else {
					next()
				}
			}
		}

		runRouterTests(Router)
	})

	describe('class syntax with Proxy', () => {
		class Router implements Types.RouterInstance {
			private routes: { [key: string]: Function } = {}
			constructor() {}

			// Handle GET requests
			get(path: string, handler: Types.RequestHandler): this {
				console.log('get', path, handler)
				this.routes[path] = handler
				return this
			}

			// Dispatch a req, res into the router.
			handle(req: object, res: object, next: (err?: any) => void): void {
				console.log('Handling request', req, res)
				const handler = this.routes[req?.url]
				if (handler) {
					handler(req, res, next)
				} else {
					next()
				}
			}
		}

		const RouterProxy = new Proxy(Router, {
			construct(target, args) {
				return new target(...args)
			},

			apply(target, thisArg, args) {
				const r = new target()
				return r.handle(...args)
			},
		})

		runRouterTests(RouterProxy)
	})
})
