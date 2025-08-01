'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// import { useAuth } from '../../lib/context/AuthContext';
import GlobalDocumentGroupFilter from './GlobalDocumentGroupFilter';
import { ThemeToggle } from '../ui/theme-toggle';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';

const Header = () => {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const pathname = usePathname();
	const isMobile = useIsMobile();
	// const { isAuthenticated, logout } = useAuth();

	const toggleMobileMenu = () => {
		setMobileMenuOpen(!mobileMenuOpen);
	};

	const handleLogout = () => {
		// logout();
		toggleMobileMenu(); // Close mobile menu if open
	};

	// Generate breadcrumbs based on current path
	const generateBreadcrumbs = () => {
		const segments = pathname.split('/').filter(Boolean);
		const breadcrumbs: Array<{
			title: string;
			href: string;
			isLast?: boolean;
		}> = [];

		// Add home/root
		if (pathname.startsWith('/news')) {
			breadcrumbs.push({ title: 'PHΛROS', href: '/news' });
		} else {
			breadcrumbs.push({ title: 'ΛLΞXΛNDRIΛ', href: '/jfk-files' });
		}

		// Add path segments
		let currentPath = '';
		segments.forEach((segment, index) => {
			currentPath += `/${segment}`;
			const title = segment
				.replace(/-/g, ' ')
				.replace(/\b\w/g, (l) => l.toUpperCase());

			if (index === segments.length - 1) {
				breadcrumbs.push({ title, href: currentPath, isLast: true });
			} else {
				breadcrumbs.push({ title, href: currentPath });
			}
		});

		return breadcrumbs;
	};

	const breadcrumbs = generateBreadcrumbs();

	return (
		<header
			className='flex h-16 shrink-0 items-center gap-2 border-b px-4'
			style={{
				background: 'linear-gradient(to right, #4f46e5, #9333ea)',
				color: 'white',
				boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
			}}
		>
			<div className='flex items-center justify-between w-full'>
				<div className='flex items-center gap-6'>
					{/* Sidebar Trigger */}
					<SidebarTrigger className='text-white hover:bg-white/10' />
					<Separator
						orientation='vertical'
						className='mr-2 h-4 bg-white/20'
					/>

					{/* Alexandria branding - shows on both mobile and desktop */}
					<div
						style={{
							display: 'block',
							flexShrink: 0,
							fontSize: '20px',
							fontWeight: 200,
							letterSpacing: '0.05em',
							textTransform: 'uppercase',
							textDecoration: 'none',
							color: 'white',
						}}
					>
						ΛLΞXΛNDRIΛ
					</div>
				</div>

				<div className='flex items-center gap-4'>
					{/* Simple, prominent theme toggle */}
					<div className='relative z-[1100]'>
						<ThemeToggle />
					</div>
				</div>
			</div>
		</header>
	);
};

export default Header;
