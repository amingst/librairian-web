// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface NewsSourceData {
	name: string;
	url: string;
	method?: string;
	category?: string;
	icon?: string;
	selectors?: {
		linkFilter?: string;
		[key: string]: any;
	};
	reason?: string;
}

interface NewsSourcesJson {
	sources: NewsSourceData[];
	disabled: NewsSourceData[];
	settings?: {
		[key: string]: any;
	};
}

async function main() {
	console.log('🌱 Starting seed...');

	// Read the news sources JSON file
	const jsonPath = path.join(__dirname, 'news-sources.json');
	const jsonData = fs.readFileSync(jsonPath, 'utf8');
	const newsData: NewsSourcesJson = JSON.parse(jsonData);

	// Seed active sources
	console.log('📰 Seeding active news sources...');
	for (const source of newsData.sources) {
		try {
			await prisma.newsSource.upsert({
				where: { name: source.name },
				update: {
					url: source.url,
					icon: source.icon || null,
					selectors: source.selectors || null,
					isActive: true,
					isDisabled: false,
					reason: null,
				},
				create: {
					name: source.name,
					url: source.url,
					icon: source.icon || null,
					selectors: source.selectors || null,
					isActive: true,
					isDisabled: false,
				},
			});
			console.log(`✅ Added/updated active source: ${source.name}`);
		} catch (error) {
			console.error(`❌ Error seeding ${source.name}:`, error);
		}
	}

	// Seed disabled sources
	console.log('🚫 Seeding disabled news sources...');
	for (const source of newsData.disabled) {
		try {
			await prisma.newsSource.upsert({
				where: { name: source.name },
				update: {
					url: source.url,
					icon: source.icon || null,
					selectors: source.selectors || null,
					isActive: false,
					isDisabled: true,
					reason: source.reason || null,
				},
				create: {
					name: source.name,
					url: source.url,
					icon: source.icon || null,
					selectors: source.selectors || null,
					isActive: false,
					isDisabled: true,
					reason: source.reason || null,
				},
			});
			console.log(
				`✅ Added/updated disabled source: ${source.name} (${source.reason})`
			);
		} catch (error) {
			console.error(`❌ Error seeding disabled ${source.name}:`, error);
		}
	}

	// Summary
	const activeCount = await prisma.newsSource.count({
		where: { isActive: true, isDisabled: false },
	});

	const disabledCount = await prisma.newsSource.count({
		where: { isDisabled: true },
	});

	console.log(`\n🎉 Seed completed successfully!`);
	console.log(`📊 Summary:`);
	console.log(`   - Active sources: ${activeCount}`);
	console.log(`   - Disabled sources: ${disabledCount}`);
	console.log(`   - Total sources: ${activeCount + disabledCount}`);
}

main()
	.catch((e) => {
		console.error('❌ Seed failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
