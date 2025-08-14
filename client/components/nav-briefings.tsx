'use client';

import {
	FileText,
	MoreHorizontal,
	Share,
	Trash2,
	type LucideIcon,
} from 'lucide-react';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@/components/ui/sidebar';
import { deleteBriefing } from '@/app/actions/pharos/briefings';

interface Briefing {
	id: string;
	title: string;
	url: string;
	createdAt: string;
}

export function NavBriefings({ briefings }: { briefings: Briefing[] }) {
	const { isMobile } = useSidebar();

	// Don't render anything if there are no briefings
	if (!briefings || briefings.length === 0) {
		return null;
	}

	const handleDelete = async (id: string) => {
		await deleteBriefing(id);
	};

	return (
		<SidebarGroup className='group-data-[collapsible=icon]:hidden'>
			<SidebarGroupLabel>Briefings</SidebarGroupLabel>
			<SidebarMenu>
				{briefings.map((briefing) => (
					<SidebarMenuItem key={briefing.id}>
						<SidebarMenuButton asChild>
							<a href={briefing.url}>
								<FileText className='w-4 h-4' />
								<span>{briefing.title}</span>
							</a>
						</SidebarMenuButton>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuAction showOnHover>
									<MoreHorizontal />
									<span className='sr-only'>More</span>
								</SidebarMenuAction>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className='w-48'
								side={isMobile ? 'bottom' : 'right'}
								align={isMobile ? 'end' : 'start'}
							>
								<DropdownMenuItem asChild>
									<a href={briefing.url}>
										<FileText className='text-muted-foreground' />
										<span>View Briefing</span>
									</a>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<Share className='text-muted-foreground' />
									<span>Share Briefing</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => handleDelete(briefing.id)}
								>
									<Trash2 className='text-muted-foreground' />
									<span>Delete Briefing</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
