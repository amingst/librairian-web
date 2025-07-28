import { PrismaClient } from '@prisma/client';
import { injectable } from 'inversify';

@injectable()
export class PrismaClientFactory {
	private static instances: Map<string, PrismaClient> = new Map();

	public static getInstance(serviceName: string): PrismaClient {
		if (!this.instances.has(serviceName)) {
			const client = new PrismaClient({
				log: ['query', 'error', 'warn'],
				datasources: {
					db: {
						url: (() => {
							const url =
								process.env[
									`${serviceName.toUpperCase()}_DATABASE_URL`
								];
							if (!url) {
								throw new Error(
									`Database URL for service "${serviceName}" is not defined in environment variables.`
								);
							}
							return url;
						})(),
					},
				},
			});
			this.instances.set(serviceName, client);
		}
		return this.instances.get(serviceName)!;
	}

	public static async disconnectAll(): Promise<void> {
		for (const [_, client] of this.instances) {
			await client.$disconnect();
		}
		this.instances.clear();
	}
}
