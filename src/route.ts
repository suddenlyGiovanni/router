import _debug from 'debug'
import { Layer } from './layer'
import type * as Types from './types'

const debug = _debug('router:route')

/**
 * Expose `Route`.
 */
export class Route implements Types.Route {
	public checkout: Types.RouterHandler<Route> = Route.makeRouterHandler('checkout')
	public connect: Types.RouterHandler<Route> = Route.makeRouterHandler('connect')
	public copy: Types.RouterHandler<Route> = Route.makeRouterHandler('copy')
	public delete: Types.RouterHandler<Route> = Route.makeRouterHandler('delete')
	public get: Types.RouterHandler<Route> = Route.makeRouterHandler('get')
	public head: Types.RouterHandler<Route> = Route.makeRouterHandler('head')
	public lock: Types.RouterHandler<Route> = Route.makeRouterHandler('lock')
	public ['m-search']: Types.RouterHandler<Route> = Route.makeRouterHandler('m-search')
	public merge: Types.RouterHandler<Route> = Route.makeRouterHandler('merge')
	public mkactivity: Types.RouterHandler<Route> = Route.makeRouterHandler('mkactivity')
	public mkcol: Types.RouterHandler<Route> = Route.makeRouterHandler('mkcol')
	public move: Types.RouterHandler<Route> = Route.makeRouterHandler('move')
	public notify: Types.RouterHandler<Route> = Route.makeRouterHandler('notify')
	public options: Types.RouterHandler<Route> = Route.makeRouterHandler('options')
	public patch: Types.RouterHandler<Route> = Route.makeRouterHandler('patch')
	public post: Types.RouterHandler<Route> = Route.makeRouterHandler('post')
	public propfind: Types.RouterHandler<Route> = Route.makeRouterHandler('propfind')
	public proppatch: Types.RouterHandler<Route> = Route.makeRouterHandler('proppatch')
	public purge: Types.RouterHandler<Route> = Route.makeRouterHandler('purge')
	public put: Types.RouterHandler<Route> = Route.makeRouterHandler('put')
	public report: Types.RouterHandler<Route> = Route.makeRouterHandler('report')
	public search: Types.RouterHandler<Route> = Route.makeRouterHandler('search')
	public subscribe: Types.RouterHandler<Route> = Route.makeRouterHandler('subscribe')
	public trace: Types.RouterHandler<Route> = Route.makeRouterHandler('trace')
	public unlock: Types.RouterHandler<Route> = Route.makeRouterHandler('unlock')
	public unsubscribe: Types.RouterHandler<Route> = Route.makeRouterHandler('unsubscribe')
	public path: Types.PathParams & string
	// route handlers for various http methods
	private methods: Record<Types.HttpMethods, unknown> = Object.create(null)
	private stack: Layer[] = []

	/**
	 * Initialize `Route` with the given `path`,
	 *
	 * @param {String} path
	 * @api private
	 */
	constructor(path: Types.PathParams) {
		debug('new %o', path)
		this.path = path
	}

	private static makeRouterHandler(method: Types.HttpMethods): Types.RouterHandler<Route> {
		return function (this: Route, ...handlers: Types.RequestHandlerParams[]): Route {
			const callbacks = handlers.slice().flat()

			if (callbacks.length === 0) {
				throw new TypeError('argument handler is required')
			}

			for (let i = 0; i < callbacks.length; i++) {
				const fn = callbacks[i]

				if (typeof fn !== 'function') {
					throw new TypeError('argument handler must be a function')
				}

				debug('%s %s', method, this.path)

				const layer = new Layer('/', {}, fn)
				layer.method = method

				this.methods[method] = true
				this.stack.push(layer)
			}

			return this
		}
	}

	/**
	 * @private
	 */
	public _handles_method(method: undefined | string): boolean {
		if (this.methods._all) {
			return true
		}

		// normalize name
		let name = typeof method === 'string' ? method.toLowerCase() : method

		if (name === 'head' && !this.methods['head']) {
			name = 'get'
		}

		return Boolean(this.methods[name])
	}

	/**
	 * @return {array} supported HTTP methods
	 * @private
	 */
	public _methods(): Uppercase<Types.HttpMethods>[] {
		let methods = Object.keys(this.methods) as Types.HttpMethods[]

		// append automatic head
		if (this.methods.get && !this.methods.head) {
			methods.push('head')
		}

		return methods.map((method) => method.toUpperCase() as Uppercase<typeof method>)
	}

	/**
	 * Add a handler for all HTTP verbs to this route.
	 *
	 * @param {array|function} handlers
	 * @return {Route} for chaining
	 *
	 * Behaves just like middleware and can respond or call `next`
	 * to continue processing.
	 *
	 * @example
	 * You can use multiple `.all` call to add multiple handlers.
	 * ```ts
	 *   function check_something(req, res, next){
	 *     next()
	 *   }
	 *
	 *   function validate_user(req, res, next){
	 *     next()
	 *   }
	 *
	 *   route
	 *   .all(validate_user)
	 *   .all(check_something)
	 *   .get(function(req, res, next){
	 *     res.send('hello world')
	 *   })
	 * ```
	 */
	public all(...handlers: Types.RouteHandler[]): Route
	public all(...handlers: Types.RequestHandlerParams[]): Route
	public all(...handlers: Types.RouteHandler[] | Types.RequestHandlerParams[]): Route {
		let callbacks = handlers.slice().flat()

		if (callbacks.length === 0) {
			throw new TypeError('argument handler is required')
		}

		for (let i = 0; i < callbacks.length; i++) {
			let fn = callbacks[i]

			if (typeof fn !== 'function') {
				throw new TypeError('argument handler must be a function')
			}

			let layer = new Layer('/', {}, fn)
			layer.method = undefined

			this.methods._all = true
			this.stack.push(layer)
		}

		return this
	}

	/**
	 * dispatch req, res into this route
	 *
	 * @private
	 */
	dispatch(req: Types.RoutedRequest, res: Types.OutgoingMessage, done: Types.NextFunction): void {
		let idx: number = 0
		let stack: Layer[] = this.stack
		let sync: number = 0

		if (stack.length === 0) {
			return done()
		}

		let method = typeof req.method === 'string' ? req.method.toLowerCase() : req.method

		if (method === 'head' && !this.methods['head']) {
			method = 'get'
		}

		req.route = this

		next()

		function next(err?: any): void {
			// signal to exit route
			if (err && err === 'route') {
				return done()
			}

			// signal to exit router
			if (err && err === 'router') {
				return done(err)
			}

			// no more matching layers
			if (idx >= stack.length) {
				return done(err)
			}

			// max sync stack
			if (++sync > 100) {
				setImmediate(next, err)
				return
			}

			let layer: Layer
			let match: undefined | boolean = undefined

			// find next matching layer
			while (match !== true && idx < stack.length) {
				layer = stack[idx++]!
				match = !layer.method || layer.method === method
			}

			// no match
			if (match !== true) {
				return done(err)
			}

			if (err) {
				layer!.handle_error(err, req, res, next)
			} else {
				layer!.handle_request(req, res, next)
			}

			sync = 0
		}
	}
}
