'use client';

import React from 'react';
import Link from 'next/link';
import MainLayout from '../../components/layout/MainLayout';

export default function DashboardPage() {
  // Mock user data for UI display
  const user = {
    name: 'User',
    articles: 0,
    lastActivity: 'Never'
  };

  return (
    <MainLayout>
      <div className="py-6">
        <h1 className="text-3xl font-bold mb-6">Welcome, {user.name}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h3 className="card-title">Saved Articles</h3>
            <p className="card-content text-2xl font-bold">{user.articles}</p>
          </div>
          <div className="card">
            <h3 className="card-title">Last Activity</h3>
            <p className="card-content">{user.lastActivity}</p>
          </div>
          <div className="card">
            <h3 className="card-title">Quick Actions</h3>
            <div className="flex flex-col gap-2 mt-4">
              <Link href="/capture" className="btn btn-primary text-center">Capture New</Link>
              <Link href="/articles" className="btn btn-secondary text-center">View Saved</Link>
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-4">Activities</h2>
        <div className="dashboard-grid">
          <Link href="/capture" className="card hover:shadow-md">
            <h3 className="card-title">Capture URL</h3>
            <p className="card-content">Save web content by entering a URL. Extract articles, capture screenshots, and more.</p>
          </Link>
          
          <Link href="/articles" className="card hover:shadow-md">
            <h3 className="card-title">My Articles</h3>
            <p className="card-content">Browse and manage your saved articles. Search, filter, and organize your content.</p>
          </Link>
          
          <Link href="/settings" className="card hover:shadow-md">
            <h3 className="card-title">Settings</h3>
            <p className="card-content">Configure your account settings, preferences, and customize your experience.</p>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
} 