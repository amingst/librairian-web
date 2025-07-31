'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// import { useAuth } from '../../lib/context/AuthContext';
import GlobalDocumentGroupFilter from './GlobalDocumentGroupFilter';
import { ThemeToggle } from '../ui/theme-toggle';
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from '@/components/ui/navigation-menu';

const Header = () => {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	// const { isAuthenticated, logout } = useAuth();

	const toggleMobileMenu = () => {
		setMobileMenuOpen(!mobileMenuOpen);
	};

	const handleLogout = () => {
		// logout();
		toggleMobileMenu(); // Close mobile menu if open
	};

	return (
		<header
			style={{
				background: 'linear-gradient(to right, #4f46e5, #9333ea)',
				color: 'white',
				padding: '12px 16px',
				boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				width: '100%',
				zIndex: 1050,
				overflow: 'visible',
				height: '64px', // Fixed height matching the body padding-top
				display: 'flex',
				alignItems: 'center',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					width: '100%',
					position: 'relative',
				}}
			>
				<div className='flex items-center gap-6'>
					<Link
						href='/jfk-files'
						style={{
							display: 'block',
							flexShrink: 0,
							fontSize: '28px',
							fontWeight: 200,
							letterSpacing: '0.05em',
							textTransform: 'uppercase',
							textDecoration: 'none',
							color: 'white',
						}}
					>
						ΛLΞXΛNDRIΛ
					</Link>
				</div>

				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '16px',
					}}
				>
					{/* <GlobalDocumentGroupFilter />
                                  <ResetFilterButton /> */}

					<nav className='flex gap-4'>
						<NavigationMenu className='bg-muted border border-border rounded-md shadow-md p-2'>
							<NavigationMenuList className='flex gap-4'>
								<NavigationMenuItem>
									<NavigationMenuLink asChild>
										<Link
											href='/jfk-files'
											className='text-sm font-medium text-foreground hover:text-primary transition-colors'
										>
											LIBRΛIRIΛN
										</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<NavigationMenuLink asChild>
										<Link
											href='/news'
											className='text-sm font-medium text-foreground hover:text-primary transition-colors'
										>
											PHΛROS
										</Link>
									</NavigationMenuLink>
								</NavigationMenuItem>
								<NavigationMenuItem>
									<div className='ml-2 relative z-[1100]'>
										<ThemeToggle />
									</div>
								</NavigationMenuItem>
							</NavigationMenuList>
						</NavigationMenu>
					</nav>
				</div>
			</div>
		</header>
	);
};

export default Header;
