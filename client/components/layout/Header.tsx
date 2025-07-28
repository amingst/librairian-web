'use client';

import React, { useState } from 'react';
import Link from 'next/link';
// import { useAuth } from '../../lib/context/AuthContext';
import GlobalDocumentGroupFilter from './GlobalDocumentGroupFilter';

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
		<header className='header bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md'>
			<div className='header-container container'>
				<Link href='/' className='logo text-white flex items-center'>
					<div className='flex items-baseline'>
						<span className='text-xl md:text-2xl font-bold tracking-wider mr-2'>
							SCRIBΞS
						</span>
						<span className='text-sm md:text-base tracking-wide mx-1'>
							OF
						</span>
						<span className='text-sm md:text-base tracking-widest stylized-alexandria ml-1'>
							ΛLΞXΛNDRIΛ
						</span>
					</div>
				</Link>

				{/* {isAuthenticated && <GlobalDocumentGroupFilter />} */}

				<nav className='nav-links'>
					<>
						<Link
							href='/about'
							className='hover:text-indigo-200 transition-colors'
						>
							About
						</Link>
						<Link
							href='/login'
							className='bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors'
						>
							Login
						</Link>
						<Link
							href='/register'
							className='border border-white text-white px-4 py-2 rounded-md hover:bg-indigo-500 transition-colors'
						>
							Sign Up
						</Link>
					</>
					{/* {isAuthenticated ? (
            <>
              <Link href="/capture" className="hover:text-indigo-200 transition-colors">Capture</Link>
              <Link href="/articles" className="hover:text-indigo-200 transition-colors">Articles</Link>
              <Link href="/dashboard" className="hover:text-indigo-200 transition-colors">Dashboard</Link>
              <Link href="/settings" className="hover:text-indigo-200 transition-colors">Settings</Link>
              <button 
                onClick={handleLogout}
                className="bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/about" className="hover:text-indigo-200 transition-colors">About</Link>
              <Link href="/login" className="bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors">Login</Link>
              <Link href="/register" className="border border-white text-white px-4 py-2 rounded-md hover:bg-indigo-500 transition-colors">Sign Up</Link>
            </>
          )} */}
				</nav>

				<button
					className='mobile-menu-button text-white'
					onClick={toggleMobileMenu}
					aria-label='Toggle mobile menu'
				>
					☰
				</button>

				{mobileMenuOpen && (
					<div
						className={`mobile-menu bg-indigo-700 ${
							mobileMenuOpen ? 'open' : ''
						}`}
					>
						<>
							<Link
								href='/about'
								onClick={toggleMobileMenu}
								className='text-white hover:bg-indigo-600 transition-colors'
							>
								About
							</Link>
							<Link
								href='/login'
								onClick={toggleMobileMenu}
								className='text-white bg-indigo-500 hover:bg-indigo-400 transition-colors p-2 m-2 rounded-md text-center'
							>
								Login
							</Link>
							<Link
								href='/register'
								onClick={toggleMobileMenu}
								className='text-white border border-white hover:bg-indigo-500 transition-colors p-2 m-2 rounded-md text-center'
							>
								Sign Up
							</Link>
						</>
						{/* {isAuthenticated && (
              <div className="py-2 mb-2 border-b border-indigo-600">
                <GlobalDocumentGroupFilter />
              </div>
            )}
            
            {isAuthenticated ? (
              <>
                <Link href="/capture" onClick={toggleMobileMenu} className="text-white hover:bg-indigo-600 transition-colors">Capture</Link>
                <Link href="/articles" onClick={toggleMobileMenu} className="text-white hover:bg-indigo-600 transition-colors">Articles</Link>
                <Link href="/dashboard" onClick={toggleMobileMenu} className="text-white hover:bg-indigo-600 transition-colors">Dashboard</Link>
                <Link href="/settings" onClick={toggleMobileMenu} className="text-white hover:bg-indigo-600 transition-colors">Settings</Link>
                <button 
                  onClick={handleLogout} 
                  className="text-white bg-indigo-500 hover:bg-indigo-400 transition-colors p-2 m-2 rounded-md text-center w-full"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/about" onClick={toggleMobileMenu} className="text-white hover:bg-indigo-600 transition-colors">About</Link>
                <Link href="/login" onClick={toggleMobileMenu} className="text-white bg-indigo-500 hover:bg-indigo-400 transition-colors p-2 m-2 rounded-md text-center">Login</Link>
                <Link href="/register" onClick={toggleMobileMenu} className="text-white border border-white hover:bg-indigo-500 transition-colors p-2 m-2 rounded-md text-center">Sign Up</Link>
              </>
            )} */}
					</div>
				)}
			</div>
		</header>
	);
};

export default Header;
