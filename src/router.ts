import type * as http from 'node:http'
import { flatten } from 'array-flatten/dist.es2015'
import d from 'debug'
import parseUrl from 'parseurl'
import mixin from 'utils-merge'

import { Layer } from './layer'
import { Route } from './route'
import type * as Types from './types'

const debug = d('router')

/**
 * Module variables.
 * @private
 */

const slice = Array.prototype.slice

/**
 * Expose `Route`.
 */

export { Route } from './route'

interface RouterOptions {
	caseSensitive?: boolean
	mergeParams?: boolean
	strict?: boolean
}

/**
 * Initialize a new `Router` with the given `options`.
 *
 * @param {object} [options]
 * @return {Router} which is a callable function
 * @public
 */
export default class Router implements Types.Router {
	public checkout: Types.RouterMatcher<Router> = Router.makeMethodHandler('checkout')
	public connect: Types.RouterMatcher<Router> = Router.makeMethodHandler('connect')
	public copy: Types.RouterMatcher<Router> = Router.makeMethodHandler('copy')
	public delete: Types.RouterMatcher<Router> = Router.makeMethodHandler('delete')
	public get: Types.RouterMatcher<Router> = Router.makeMethodHandler('get')
	public head: Types.RouterMatcher<Router> = Router.makeMethodHandler('head')
	public lock: Types.RouterMatcher<Router> = Router.makeMethodHandler('lock')
	public 'm-search': Types.RouterMatcher<Router> = Router.makeMethodHandler('m-search')
	public merge: Types.RouterMatcher<Router> = Router.makeMethodHandler('merge')
	public mkactivity: Types.RouterMatcher<Router> = Router.makeMethodHandler('mkactivity')
	public mkcol: Types.RouterMatcher<Router> = Router.makeMethodHandler('mkcol')
	public move: Types.RouterMatcher<Router> = Router.makeMethodHandler('move')
	public notify: Types.RouterMatcher<Router> = Router.makeMethodHandler('notify')
	public options: Types.RouterMatcher<Router> = Router.makeMethodHandler('options')
	public patch: Types.RouterMatcher<Router> = Router.makeMethodHandler('patch')
	public post: Types.RouterMatcher<Router> = Router.makeMethodHandler('post')
	public propfind: Types.RouterMatcher<Router> = Router.makeMethodHandler('propfind')
	public proppatch: Types.RouterMatcher<Router> = Router.makeMethodHandler('proppatch')
	public purge: Types.RouterMatcher<Router> = Router.makeMethodHandler('purge')
	public put: Types.RouterMatcher<Router> = Router.makeMethodHandler('put')
	public report: Types.RouterMatcher<Router> = Router.makeMethodHandler('report')
	public search: Types.RouterMatcher<Router> = Router.makeMethodHandler('search')
	public subscribe: Types.RouterMatcher<Router> = Router.makeMethodHandler('subscribe')
	public trace: Types.RouterMatcher<Router> = Router.makeMethodHandler('trace')
	public unlock: Types.RouterMatcher<Router> = Router.makeMethodHandler('unlock')
	public unsubscribe: Types.RouterMatcher<Router> = Router.makeMethodHandler('unsubscribe')

	private caseSensitive: undefined | boolean = undefined
	private mergeParams: undefined | boolean = undefined
	private params: Record<string, unknown[]> = {}
	private stack: Layer[] = []
	private strict: undefined | boolean = undefined

	public constructor(options: RouterOptions = {}) {
		this.caseSensitive = options.caseSensitive
		this.mergeParams = options.mergeParams
		this.strict = options.strict
	}

	/**
	 * Generate a callback that will make an OPTIONS response.
	 *
	 * @param {OutgoingMessage} res
	 * @param {array} methods
	 * @private
	 */
	private static generateOptionsResponder(
		res: Types.OutgoingMessage,
		methods: Uppercase<Types.HttpMethods>[],
	): (fn: Types.NextFunction, err?: any) => void {
		return function onDone(fn: Types.NextFunction, err?: any): void {
			if (err || methods.length === 0) {
				fn(err)
				return
			}

			Router.trySendOptionsResponse(res, methods, fn)
		}
	}

	/**
	 * Get pathname of request.
	 *
	 * @param {IncomingMessage} req
	 * @private
	 */
	private static getPathname(req: http.IncomingMessage): undefined | null | string {
		try {
			return parseUrl(req)?.pathname
		} catch (err) {
			return undefined
		}
	}

	/**
	 * Get get protocol + host for a URL.
	 *
	 * @param {string} url
	 * @private
	 */

	private static getProtohost(url: string): undefined | string {
		if (typeof url !== 'string' || url.length === 0 || url[0] === '/') {
			return undefined
		}

		let searchIndex: number = url.indexOf('?')
		let pathLength: number = searchIndex !== -1 ? searchIndex : url.length
		let fqdnIndex: number = url.substring(0, pathLength).indexOf('://')

		return fqdnIndex !== -1
			? url.substring(0, url.indexOf('/', 3 + fqdnIndex)) //
			: undefined
	}

	private static makeMethodHandler(method: Types.HttpMethods): Types.RouterMatcher<Router> {
		return function routerMatcher(this: Router, path, ...handlers): Router {
			const route: Route = this.route(path)
			route[method].apply(route, handlers)
			return this
		}
	}

	/**
	 * Match path to a layer.
	 *
	 * @param {Layer} layer
	 * @param {string} path
	 * @private
	 */
	private static matchLayer(layer: Layer, path: string): boolean {
		try {
			return layer.match(path)
		} catch (err: unknown) {
			// @ts-expect-error FIXME: most likely should not return an error in the catch clause right?
			return err
		}
	}

	/**
	 * Merge params with parent params
	 *
	 * @private
	 */
	private static mergeParams<
		Params extends Record<string, string>,
		Parent extends Record<string, string>,
	>(params: Params, parent: Parent) {
		if (typeof parent !== 'object' || !parent) {
			return params
		}

		// make copy of parent for base
		const obj: Parent = mixin({}, parent)

		// simple non-numeric merging
		if (!(0 in params) || !(0 in parent)) {
			return mixin(obj, params)
		}

		let i: number = 0
		let o: number = 0

		// determine numeric gap in params
		while (i in params) {
			i++
		}

		// determine numeric gap in parent
		while (o in parent) {
			o++
		}

		// offset numeric indices in params before merge
		for (i--; i >= 0; i--) {
			params[i + o] = params[i]

			// create holes for the merge when necessary
			if (i < o) {
				delete params[i]
			}
		}

		return mixin(obj, params)
	}

	/**
	 * Restore obj props after function
	 *
	 * @private
	 * @internal
	 */
	public static restore<
		Obj extends Record<string, any>,
		Keys extends (keyof Obj)[],
		Fn extends (...args: any[]) => any,
	>(fn: Fn, obj: Obj, ...keys: [...Keys]): (...args: Parameters<Fn>) => ReturnType<Fn> {
		const originalValues = keys.reduce(
			(acc, key) => {
				acc[key] = obj[key]
				return acc
			},
			{} as Obj[Keys[number]],
		)

		return (...args) => {
			for (const key of keys) {
				obj[key] = originalValues[key]
			}
			return fn(...args)
		}
	}

	/**
	 * Send an OPTIONS response.
	 *
	 * @private
	 */
	private static sendOptionsResponse(
		res: Types.OutgoingMessage,
		methods: Uppercase<Types.HttpMethods>[],
	): void {
		// TODO: this could be re-written with a reduce and a Map!
		const options: Record<Uppercase<Types.HttpMethods>, boolean> = Object.create(null)
		// build unique method map
		for (const m of methods) {
			options[m] = true
		}

		// construct the allow list: "GET, POST, HEAD"
		const allow: string = Object.keys(options).sort().join(', ')

		// send response
		res.setHeader('Allow', allow)
		res.setHeader('Content-Length', Buffer.byteLength(allow))
		res.setHeader('Content-Type', 'text/plain')
		res.setHeader('X-Content-Type-Options', 'nosniff')
		res.end(allow)
	}

	/**
	 * Try to send an OPTIONS response.
	 *
	 * @private
	 */
	private static trySendOptionsResponse(
		res: Types.OutgoingMessage,
		methods: Uppercase<Types.HttpMethods>[],
		next: Types.NextFunction,
	): void {
		try {
			Router.sendOptionsResponse(res, methods)
		} catch (err: unknown) {
			next(err)
		}
	}

	/**
	 * Wrap a function
	 *
	 * @private
	 */
	private static wrap<
		AnyFunction extends (...args: any[]) => any,
		F extends AnyFunction,
		G extends (...args: [F, ...Parameters<F>]) => ReturnType<F>,
	>(f: F, g: G): (...fArgs: Parameters<F>) => ReturnType<F> {
		return (...fArgs) => g(f, ...fArgs)
	}

	public all(path: Types.PathParams, ...handlers: Types.RouterHandler<Router>[]): Router {
		const route: Route = this.route(path)
		route.all.apply(route, handlers)
		return this
	}

	public param(this: Router, name: string, handler: Types.RequestParamHandler): Router {
		if (!name) {
			throw new TypeError('argument name is required')
		}

		if (typeof name !== 'string') {
			throw new TypeError('argument name must be a string')
		}

		if (!handler) {
			throw new TypeError('argument fn is required')
		}

		if (typeof handler !== 'function') {
			throw new TypeError('argument fn must be a function')
		}

		let params = this.params[name]

		if (!params) {
			params = this.params[name] = []
		}

		params.push(handler)

		return this
	}

	/**
	 * Create a new Route for the given path.
	 *
	 * Each route contains a separate middleware stack and VERB handlers.
	 *
	 * See the Route api documentation for details on adding handlers
	 * and middleware to routes.
	 *
	 * @param {string} path
	 * @return {Route}
	 * @public
	 */
	public route(path: Types.PathParams): Route {
		const route = new Route(path)

		const layer = new Layer(
			path,
			{
				sensitive: this.caseSensitive,
				strict: this.strict,
				end: true,
			},
			handle,
		)

		function handle(
			req: Types.RoutedRequest,
			res: Types.OutgoingMessage,
			next: Types.NextFunction,
		): void {
			route.dispatch(req, res, next)
		}

		layer.route = route

		this.stack.push(layer)
		return route
	}

	/**
	 * Use the given middleware function, with optional path, defaulting to "/".
	 *
	 * Use (like `.all`) will run for any http METHOD, but it will not add
	 * handlers for those methods so OPTIONS requests will not consider `.use`
	 * functions even if they could respond.
	 *
	 * The other difference is that _route_ path is stripped and not visible
	 * to the handler function. The main effect of this feature is that mounted
	 * handlers can operate without any code changes regardless of the "prefix"
	 * pathname.
	 *
	 * @public
	 */
	public use(path: Types.PathParams, ...handlers: Types.RequestHandlerParams[]): Router
	public use(path: Types.PathParams, ...handlers: Types.RouteHandler[]): Router
	public use(...handlers: Types.RouteHandler[]): Router
	public use(...handlers: Types.RequestHandlerParams[]): Router
	public use(handler: unknown): Router {
		let offset: number = 0
		let path: string = '/'

		// default path to '/'
		// disambiguate router.use([handler])
		if (typeof handler !== 'function') {
			let arg = handler

			while (Array.isArray(arg) && arg.length !== 0) {
				arg = arg[0]
			}

			// first arg is the path
			if (typeof arg !== 'function') {
				offset = 1
				path = handler
			}
		}

		const callbacks = flatten(slice.call(arguments, offset))

		if (callbacks.length === 0) {
			throw new TypeError('argument handler is required')
		}

		for (let i = 0; i < callbacks.length; i++) {
			const fn = callbacks[i]

			if (typeof fn !== 'function') {
				throw new TypeError('argument handler must be a function')
			}

			// add the middleware
			debug('use %o %s', path, fn.name || '<anonymous>')

			const layer = new Layer(
				path,
				{
					sensitive: this.caseSensitive,
					strict: false,
					end: false,
				},
				fn,
			)

			layer.route = undefined

			this.stack.push(layer)
		}

		return this
	}

	/**
	 * Dispatch a req, res into the router.
	 *
	 * @private
	 */
	public handle(
		req: Types.IncomingRequest,
		res: Types.OutgoingMessage,
		callback: Types.NextFunction,
	): void {
		if (!callback) {
			throw new TypeError('argument callback is required')
		}

		debug('dispatching %s %s', req.method, req.url)

		let idx: number = 0
		let methods: Uppercase<Types.HttpMethods>[]
		const protohost: string = Router.getProtohost(req.url) || ''
		let removed: string = ''
		const self = this
		let slashAdded: boolean = false
		let sync: number = 0
		const paramcalled = {}

		// middleware and routes
		const stack: Layer[] = this.stack

		// manage inter-router variables
		const parentParams: Record<string, string> = req.params
		const parentUrl: string = req?.baseUrl || ''
		let done: Types.NextFunction = Router.restore(callback, req, 'baseUrl', 'next', 'params')

		// setup next layer
		req.next = next

		// for options requests, respond with a default if nothing else responds
		if (req.method === 'OPTIONS') {
			methods = []
			done = Router.wrap(done, Router.generateOptionsResponder(res, methods))
		}

		// setup basic req values
		req.baseUrl = parentUrl
		req.originalUrl = req.originalUrl || req.url

		next()

		function next(err?: any): void {
			let layerError: null | any = err === 'route' ? null : err

			// remove added slash
			if (slashAdded) {
				req.url = req.url.slice(1)
				slashAdded = false
			}

			// restore altered req.url
			if (removed.length !== 0) {
				req.baseUrl = parentUrl
				req.url = protohost + removed + req.url.slice(protohost.length)
				removed = ''
			}

			// signal to exit router
			if (layerError === 'router') {
				setImmediate(done, null)
				return
			}

			// no more matching layers
			if (idx >= stack.length) {
				setImmediate(done, layerError)
				return
			}

			// max sync stack
			if (++sync > 100) {
				setImmediate(next, err)
				return
			}

			// get pathname of request
			const path: undefined | null | string = Router.getPathname(req)

			if (path === null || path === undefined) {
				done(layerError)
				return
			}

			// find next matching layer
			let layer: Layer
			let match: boolean
			let route: Route

			while (match !== true && idx < stack.length) {
				layer = stack[idx++]
				match = Router.matchLayer(layer, path)
				route = layer.route

				if (typeof match !== 'boolean') {
					// hold on to layerError
					layerError = layerError || match
				}

				if (match !== true) {
					continue
				}

				if (!route) {
					// process non-route handlers normally
					continue
				}

				if (layerError) {
					// routes do not match with a pending error
					match = false
					continue
				}

				let method = req?.method
				let has_method: boolean = route._handles_method(method)

				// build up automatic options response
				if (!has_method && method === 'OPTIONS' && methods) {
					methods.push.apply(methods, route._methods())
				}

				// don't even bother matching route
				if (!has_method && method !== 'HEAD') {
					match = false
					continue
				}
			}

			// no match
			if (match !== true) {
				done(layerError)
				return
			}

			// store route for dispatch on change
			if (route) {
				req.route = route
			}

			// Capture one-time layer values
			req.params = self.mergeParams
				? Router.mergeParams(layer.params, parentParams) //
				: layer.params
			const layerPath = layer?.path

			// this should be done for the layer
			self.process_params(layer, paramcalled, req, res, (err) => {
				if (err) {
					next(layerError || err)
				} else if (route) {
					layer.handle_request(req, res, next)
				} else {
					trim_prefix(layer, layerError, layerPath, path)
				}

				sync = 0
			})
		}

		function trim_prefix(
			layer: Layer,
			layerError: unknown,
			layerPath: Types.PathParams,
			path: string,
		): void {
			if (layerPath.length !== 0) {
				// Validate path is a prefix match
				if (layerPath !== path.substring(0, layerPath.length)) {
					next(layerError)
					return
				}

				// Validate path breaks on a path separator
				const c = path[layerPath.length]
				if (c && c !== '/') {
					next(layerError)
					return
				}

				// Trim off the part of the url that matches the route
				// middleware (.use stuff) needs to have the path stripped
				debug('trim prefix (%s) from url %s', layerPath, req.url)
				removed = layerPath
				req.url = protohost + req.url.slice(protohost.length + removed.length)

				// Ensure leading slash
				if (!protohost && req.url[0] !== '/') {
					req.url = '/' + req.url
					slashAdded = true
				}

				// Setup base URL (no trailing slash)
				req.baseUrl =
					parentUrl +
					(removed[removed.length - 1] === '/' ? removed.substring(0, removed.length - 1) : removed)
			}

			debug('%s %s : %s', layer.name, layerPath, req.originalUrl)

			if (layerError) {
				layer.handle_error(layerError, req, res, next)
			} else {
				layer.handle_request(req, res, next)
			}
		}
	}

	/**
	 * Process any parameters for the layer.
	 *
	 * @private
	 */
	private process_params<Called extends Record<string, unknown>>(
		layer: Layer,
		called: Called,
		req: Types.IncomingRequest,
		res: Types.OutgoingMessage,
		done: (err?: any) => void,
	): void {
		const params = this.params

		// captured parameters from the layer, keys and values
		const keys = layer.keys

		// fast track
		if (!keys || keys.length === 0) {
			done()
			return
		}

		let i: number = 0
		let name: undefined | string = undefined
		let paramIndex: number = 0
		let key: undefined | { name: string } = undefined
		let paramVal
		let paramCallbacks: unknown[]
		let paramCalled: { error: unknown; value: unknown; match: unknown }

		// process params in order
		// param callbacks can be async
		function param(err?: unknown): void {
			if (err) {
				done(err)
				return
			}

			if (i >= keys.length) {
				done()
				return
			}

			paramIndex = 0
			key = keys[i++]
			name = key.name
			paramVal = req.params[name]
			paramCallbacks = params[name]
			paramCalled = called[name]

			if (paramVal === undefined || !paramCallbacks) {
				param()
				return
			}

			// param previously called with same value or error occurred
			if (
				paramCalled &&
				(paramCalled.match === paramVal || (paramCalled.error && paramCalled.error !== 'route'))
			) {
				// restore value
				req.params[name] = paramCalled.value

				// next param
				param(paramCalled.error)
				return
			}

			called[name] = paramCalled = {
				error: null,
				match: paramVal,
				value: paramVal,
			}

			paramCallback()
		}

		// single param callbacks
		function paramCallback(err?: unknown): void {
			let fn = paramCallbacks[paramIndex++]

			// store updated value
			paramCalled.value = req.params[key.name]

			if (err) {
				// store error
				paramCalled.error = err
				param(err)
				return
			}

			if (!fn) {
				param()
				return
			}

			try {
				fn(req, res, paramCallback, paramVal, key.name)
			} catch (e: unknown) {
				paramCallback(e)
			}
		}

		param()
	}
}

// create Router#VERB functions
// methods.concat("all").forEach(function (method) {
//   Router.prototype[method] = function (path, ...handlers) {
//     var route = this.route(path);
//     route[method].apply(route, handlers);
//     return this;
//   };
// });
