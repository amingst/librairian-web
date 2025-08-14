// News homepage and site configuration types

import { SiteConfig } from '@shared/types';

export interface NewsHomepageParams {
	sites: SiteConfig[];
	limit?: number;
	includeMedia?: boolean;
	includeSections?: boolean;
	includeMetrics?: boolean;
	sortBy?: 'position' | 'date' | 'priority';
	userPreferences?: Record<string, any>;
}
