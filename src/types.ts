import type * as Http from 'node:http'
import type { OutgoingMessage, ServerResponse } from 'node:http'
export type { OutgoingMessage, ServerResponse }

export type HttpMethods =
	| 'checkout'
	| 'connect'
	| 'copy'
	| 'delete'
	| 'get'
	| 'head'
	| 'lock'
	| 'm-search'
	| 'merge'
	| 'mkactivity'
	| 'mkcol'
	| 'move'
	| 'notify'
	| 'options'
	| 'patch'
	| 'post'
	| 'propfind'
	| 'proppatch'
	| 'purge'
	| 'put'
	| 'report'
	| 'search'
	| 'subscribe'
	| 'trace'
	| 'unlock'
	| 'unsubscribe'

export interface RouterOptions {
	caseSensitive?: boolean
	mergeParams?: boolean
	strict?: boolean
}

export type Request = InstanceType<typeof Http.IncomingMessage>
export type Response = InstanceType<typeof Http.ServerResponse> & { req: Request }

export interface IncomingRequest extends Request {
	originalUrl?: string
	params?: Record<string, string>
}

interface BaseRoutedRequest extends IncomingRequest {
	baseUrl: string
	next?: NextFunction
	route?: Route
}

export type RoutedRequest = BaseRoutedRequest & {
	[key: string]: any
}

export interface NextFunction {
	(err?: any): void
}

export type Route = Record<HttpMethods, RouterHandler<Route>> & {
	path: string
	all: RouterHandler<Route>
}

export type RequestParamHandler = (
	req: IncomingRequest,
	res: Response,
	next: NextFunction,
	value: string,
	name: string,
) => void

export interface RouteHandler {
	(req: RoutedRequest, res: Response, next: NextFunction): void
}

export interface RequestHandler {
	(req: IncomingRequest, res: Response, next: NextFunction): void
}

export type ErrorRequestHandler = (
	err: any,
	req: IncomingRequest,
	res: Response,
	next: NextFunction,
) => void

export type PathParams = string | RegExp | Array<string | RegExp>

export type RequestHandlerParams =
	| RouteHandler
	| ErrorRequestHandler
	| Array<RouteHandler | ErrorRequestHandler>

export interface RouterMatcher<T> {
	(path: PathParams, ...handlers: RouteHandler[]): T
	(path: PathParams, ...handlers: RequestHandlerParams[]): T
}

export interface RouterHandler<T> {
	(...handlers: RouteHandler[]): T
	(...handlers: RequestHandlerParams[]): T
}

export type Router = Record<HttpMethods, RouterMatcher<Router>> & {
	param(name: string, handler: RequestParamHandler): Router
	param(callback: (name: string, matcher: RegExp) => RequestParamHandler): Router
	all: RouterMatcher<Router>
	use: RouterHandler<Router> & RouterMatcher<Router>
	handle: RequestHandler
	route(prefix: PathParams): Route
}

export interface RouterConstructor {
	new (options?: RouterOptions): Router & RequestHandler
	(options?: RouterOptions): Router & RequestHandler
}
