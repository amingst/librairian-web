'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import {
	BookOpen,
	FileText,
	Newspaper,
	Settings2,
	Library,
	Search,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavProjects } from '@/components/nav-projects';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import { PlatformSwitcher } from '@/components/platform-switcher';
import { useSidebarData, fallbackSidebarData } from '@/hooks/use-sidebar-data';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';

// Shared data that doesn't change per platform
const sharedData = {
	user: {
		name: 'John Doe',
		email: 'jdoe@example.com',
		avatar: 'https://github.com/shadcn.png',
	},
	settings: [
		{
			title: 'Settings',
			url: '/settings',
			icon: Settings2,
			items: [
				{
					title: 'General',
					url: '/settings',
				},
				{
					title: 'Theme',
					url: '/settings/theme',
				},
				{
					title: 'Data Sources',
					url: '/settings/sources',
				},
			],
		},
	],
	navSecondary: [
		{
			title: 'Documentation',
			url: '/docs',
			icon: BookOpen,
		},
		{
			title: 'Search',
			url: '/search',
			icon: Search,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const pathname = usePathname();
	const serverSidebarData = useSidebarData();

	// Determine the current platform based on the route
	const getCurrentPlatform = () => {
		if (pathname.startsWith('/pharos')) {
			return 'pharos';
		}
		return 'librarian';
	};

	const currentPlatform = getCurrentPlatform();

	// Use server-side data if available, otherwise fall back to static data
	const platformData =
		serverSidebarData || fallbackSidebarData[currentPlatform];

	// Convert icon strings to actual icon components
	const iconMap: { [key: string]: any } = {
		Library,
		Newspaper,
		FileText,
		BookOpen,
		Search,
		Settings2,
	};

	// Process the navigation data to include actual icon components
	const processedNavMain = platformData.navMain.map((item) => ({
		...item,
		icon: iconMap[item.icon] || Library,
		isActive:
			pathname.startsWith(item.url) ||
			item.items?.some((subItem: any) => pathname === subItem.url),
	}));

	const processedProjects = platformData.projects.map((project) => ({
		...project,
		icon: iconMap[project.icon] || FileText,
	}));

	return (
		<Sidebar {...props}>
			<SidebarHeader>
				<PlatformSwitcher platforms={['librarian', 'pharos']} />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={processedNavMain} />
				<NavProjects projects={processedProjects} />
				{/* Settings - shared across platforms */}
				<NavMain items={sharedData.settings} />
				<NavSecondary
					items={sharedData.navSecondary}
					className='mt-auto'
				/>
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={sharedData.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
