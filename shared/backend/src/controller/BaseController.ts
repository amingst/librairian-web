import { Router } from 'express';
import { injectable } from 'inversify';

@injectable()
export abstract class BaseController {
	protected router: Router;
	constructor() {
		this.router = Router();
	}

	public getRouter() {
		return this.router;
	}
}
