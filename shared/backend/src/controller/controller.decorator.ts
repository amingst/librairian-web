import { Router, Request, Response, Application } from 'express';
import 'reflect-metadata';

const ROUTES_METADATA_KEY = Symbol('routes');

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
const CONTROLLER_REGISTRY: { basePath: string; router: Router }[] = [];

interface RouteDefinition {
	method: HttpMethod;
	path: string;
	handler: string;
}

export function controller(basePath: string) {
	return function <T extends { new (...args: any[]): {} }>(constructor: T) {
		return class extends constructor {
			public router = Router();

			constructor(...args: any[]) {
				super(...args);

				console.log(
					`[Controller] Registering: ${constructor.name} at /api${basePath}`
				);

				// Get metadata from prototype (NOT constructor)
				const routes =
					Reflect.getMetadata(
						ROUTES_METADATA_KEY,
						constructor.prototype
					) || [];

				if (routes.length === 0) {
					console.warn(
						`[Warning] No routes found for ${constructor.name}`
					);
				}

				for (const route of routes) {
					console.log(
						`[Route] ${route.method.toUpperCase()} -> /api${basePath}${
							route.path
						}`
					);
					(this.router as any)[route.method](
						route.path, // Fix path handling
						(req: Request, res: Response) => {
							(this as any)[route.handler](req, res);
						}
					);
				}

				CONTROLLER_REGISTRY.push({ basePath, router: this.router });
			}
		};
	};
}

function createRouteDecorator(method: 'get' | 'post' | 'put' | 'delete') {
	return function (path: string) {
		return function (target: any, propertyKey: string) {
			const routes =
				Reflect.getMetadata(ROUTES_METADATA_KEY, target) || [];
			routes.push({ method, path, handler: propertyKey });
			Reflect.defineMetadata(ROUTES_METADATA_KEY, routes, target);
		};
	};
}

export const get = createRouteDecorator('get');
export const post = createRouteDecorator('post');
export const put = createRouteDecorator('put');
export const del = createRouteDecorator('delete');

export function registerControllers(app: Application) {
	console.log(
		`[Registering Controllers] Found ${CONTROLLER_REGISTRY.length} controllers`
	);
	for (const { basePath, router } of CONTROLLER_REGISTRY) {
		console.log(`[Express] Mounting controller at: /api${basePath}`);
		app.use(`/api${basePath}`, router);
	}
}
