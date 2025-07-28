'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// import { useAuth } from '../../lib/context/AuthContext';
import GlobalDocumentGroupFilter from './GlobalDocumentGroupFilter';
import { ThemeToggle } from '../ui/theme-toggle';

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
				position: 'relative',
				width: '100%',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					maxWidth: '1280px',
					margin: '0 auto',
					width: '100%',
					position: 'relative',
				}}
			>
				<ThemeToggle />
				<a
					href='/jfk-files'
					style={{
						display: 'block',
						flexShrink: 0,
						marginRight: '16px',
						fontSize: '28px',
						fontWeight: 200,
						letterSpacing: '0.05em',
						textTransform: 'uppercase',
						textDecoration: 'none',
						color: 'white',
					}}
				>
					LIBRΛIRIΛN
				</a>
				<div
					style={{
						marginLeft: 'auto',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
					}}
				>
					{/* <GlobalDocumentGroupFilter />
                                  <ResetFilterButton /> */}
				</div>
			</div>
		</header>
	);
};

export default Header;
