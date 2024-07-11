import { type OutgoingMessage, createServer } from 'node:http'

import Router from './router'
import type * as Types from './types'

const options: Types.RouterOptions = {
	strict: false,
	caseSensitive: false,
	mergeParams: false,
}

// new constructor
new Router().all('/', (req, res, next) => {})
// direct call
// Router().all('/', (req, res, next) => {})

const router = new Router(options)
const routerHandler: Types.RouteHandler = (_req, res, next) => {
	res.setHeader('Content-Type', 'plain/text')
	res.write('Hello')
	res.end('world')
}

// test verb methods
router.get('/', routerHandler)
router.post('/', routerHandler)
router.delete('/', routerHandler)
router.patch('/', routerHandler)
router.options('/', routerHandler)
router.head('/', routerHandler)
router.bind('/', routerHandler)
router.connect('/', routerHandler)
router.trace('/', routerHandler)
router['m-search']('/', routerHandler)

// param
router.param('user_id', (req, res, next, id) => {
	type TReq = Expect<Equal<typeof req, Types.IncomingRequest>>
	type TRes = Expect<Equal<typeof res, OutgoingMessage>>
	type TNext = Expect<Equal<typeof next, Types.NextFunction>>
	type P1 = Expect<Equal<typeof id, string>>
})

// middleware
router.use((req, res, next) => {
	type TReq = Expect<Equal<typeof req, Types.RoutedRequest>>
	type TRes = Expect<Equal<typeof res, OutgoingMessage>>
	type TNext = Expect<Equal<typeof next, Types.NextFunction>>
	next()
})

// RoutedRequest is extended with properties without type errors
router.use((req, res, next) => {
	req.extendable = 'extendable'
	next()
})

router
	.route('/')
	.all((req, res, next) => {
		type TReq = Expect<Equal<typeof req, Types.RoutedRequest>>
		type TRes = Expect<Equal<typeof res, OutgoingMessage>>
		type TNext = Expect<Equal<typeof next, Types.NextFunction>>
		next()
	})
	.get((req, res, next) => {
		type TReq = Expect<Equal<typeof req, Types.RoutedRequest>>
		type TRes = Expect<Equal<typeof res, OutgoingMessage>>
		type TNext = Expect<Equal<typeof next, Types.NextFunction>>
	})

// valid for router from createServer
createServer((req, res) => {
	// router(req, res, (err) => {})
	router.handle(req, res, (_err) => {})
})

// Type test helper methods
type Compute<T> = T extends (...args: any[]) => any ? T : { [K in keyof T]: Compute<T[K]> }

type Equal<X, Y> = (<T>() => T extends Compute<X> ? 1 : 2) extends <T>() => T extends Compute<Y>
	? 1
	: 2
	? true
	: false

type Expect<T extends true> = T extends true ? true : never
