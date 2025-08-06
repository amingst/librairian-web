import { PrismaClient } from '@prisma/client';
import { injectable } from 'inversify';

export interface WhereInput extends Record<string, any> {}
export interface SelectInput extends Record<string, any> {}
export interface IncludeInput extends Record<string, any> {}
export interface OrderByInput extends Record<string, any> {}

export type FindManyOptions<T> = {
	where?: WhereInput;
	select?: SelectInput;
	include?: IncludeInput;
	orderBy?: OrderByInput;
	take?: number;
	skip?: number;
	cursor?: Record<string, any>;
};

@injectable()
export abstract class Repository<T> {
	constructor(
		private readonly prisma: PrismaClient,
		private readonly modelName: string
	) {}

	protected get client(): PrismaClient {
		return this.prisma;
	}

	async create(data: Partial<T>): Promise<T> {
		try {
			const result = await (this.prisma as any)[this.modelName].create({
				data,
			});
			console.log(
				`✅ Created ${this.modelName} record:`,
				result.id || result.name || 'success'
			);
			return result;
		} catch (error) {
			console.error(`❌ Error creating ${this.modelName}:`, error);
			throw error;
		}
	}

	async findMany(options: FindManyOptions<T> = {}): Promise<T[]> {
		try {
			return await (this.prisma as any)[this.modelName].findMany(options);
		} catch (error) {
			console.error(`❌ Error finding ${this.modelName} records:`, error);
			throw error;
		}
	}

	async findOne(
		where: WhereInput,
		options: { select?: SelectInput; include?: IncludeInput } = {}
	): Promise<T | null> {
		try {
			return await (this.prisma as any)[this.modelName].findFirst({
				where,
				...options,
			});
		} catch (error) {
			console.error(`❌ Error finding ${this.modelName} record:`, error);
			throw error;
		}
	}

	async findById(id: string | number): Promise<T | null> {
		return this.findOne({ id });
	}

	async update(where: WhereInput, data: Partial<T>): Promise<T> {
		try {
			const result = await (this.prisma as any)[this.modelName].update({
				where,
				data,
			});
			console.log(
				`✅ Updated ${this.modelName} record:`,
				result.id || 'success'
			);
			return result;
		} catch (error) {
			console.error(`❌ Error updating ${this.modelName}:`, error);
			throw error;
		}
	}

	async delete(where: WhereInput): Promise<T> {
		try {
			const result = await (this.prisma as any)[this.modelName].delete({
				where,
			});
			console.log(
				`✅ Deleted ${this.modelName} record:`,
				result.id || 'success'
			);
			return result;
		} catch (error) {
			console.error(`❌ Error deleting ${this.modelName}:`, error);
			throw error;
		}
	}

	async count(where?: WhereInput): Promise<number> {
		try {
			return await (this.prisma as any)[this.modelName].count({ where });
		} catch (error) {
			console.error(
				`❌ Error counting ${this.modelName} records:`,
				error
			);
			throw error;
		}
	}
}
