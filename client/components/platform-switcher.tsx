'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Library } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@/components/ui/sidebar';

const platformRoutes = {
	librarian: '/jfk-files',
	pharos: '/news',
};

const platformSubtitles = {
	librarian: 'Document Analysis',
	pharos: 'News Intelligence',
};

const platformDisplayNames = {
	librarian: 'LIBRΛIRIΛN',
	pharos: 'PHΛROS',
};

export function PlatformSwitcher({ platforms }: { platforms: string[] }) {
	const pathname = usePathname();
	const router = useRouter();

	// Determine current platform based on route
	const getCurrentPlatform = () => {
		if (pathname.startsWith('/news')) {
			return 'pharos';
		}
		return 'librarian';
	};

	const selectedPlatform = getCurrentPlatform();

	const handlePlatformSwitch = (platform: string) => {
		const route = platformRoutes[platform as keyof typeof platformRoutes];
		if (route) {
			router.push(route);
		}
	};
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size='lg'
							className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
						>
							<div className='bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex aspect-square size-8 items-center justify-center rounded-lg'>
								<Library className='size-4' />
							</div>
							<div className='flex flex-col gap-0.5 leading-none'>
								<span className='font-medium'>
									{
										platformDisplayNames[
											selectedPlatform as keyof typeof platformDisplayNames
										]
									}
								</span>
								<span className='text-xs text-muted-foreground'>
									{
										platformSubtitles[
											selectedPlatform as keyof typeof platformSubtitles
										]
									}
								</span>
							</div>
							<ChevronsUpDown className='ml-auto' />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className='w-[--radix-dropdown-menu-trigger-width]'
						align='start'
					>
						{platforms.map((platform) => (
							<DropdownMenuItem
								key={platform}
								onSelect={() => handlePlatformSwitch(platform)}
							>
								{platformDisplayNames[
									platform as keyof typeof platformDisplayNames
								] || platform}{' '}
								{platform === selectedPlatform && (
									<Check className='ml-auto' />
								)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
