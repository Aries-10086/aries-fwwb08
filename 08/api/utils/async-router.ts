import type { NextFunction, Request, RequestHandler, Response, Router } from 'express'

type RouteLayer = {
  handle: RequestHandler
}

type RouterLayer = {
  route?: {
    stack?: RouteLayer[]
  }
}

type InspectableRouter = Router & {
  stack: RouterLayer[]
}

/**
 * Express 4 does not forward rejected handler promises to error middleware.
 * Wrap every handler registered on a router before exporting it.
 */
export function wrapAsyncRouter(router: Router): Router {
  for (const layer of (router as InspectableRouter).stack) {
    for (const routeLayer of layer.route?.stack ?? []) {
      const handler = routeLayer.handle
      routeLayer.handle = (req: Request, res: Response, next: NextFunction) => {
        try {
          Promise.resolve(handler(req, res, next)).catch(next)
        } catch (error) {
          next(error)
        }
      }
    }
  }
  return router
}
