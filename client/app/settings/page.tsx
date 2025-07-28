'use client';

import React, { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';

export default function SettingsPage() {
  const [notification, setNotification] = useState('');
  
  // Mock form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('Settings saved successfully!');
    
    // Clear notification after 3 seconds
    setTimeout(() => {
      setNotification('');
    }, 3000);
  };

  return (
    <MainLayout>
      <div className="py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        
        {notification && (
          <div className="bg-green-100 text-green-800 p-4 rounded mb-6">
            {notification}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-xl font-bold mb-4">Settings Menu</h2>
            <nav className="space-y-2">
              <a href="#account" className="block p-2 hover:bg-gray-100 rounded">Account</a>
              <a href="#appearance" className="block p-2 hover:bg-gray-100 rounded">Appearance</a>
              <a href="#notifications" className="block p-2 hover:bg-gray-100 rounded">Notifications</a>
              <a href="#privacy" className="block p-2 hover:bg-gray-100 rounded">Privacy</a>
            </nav>
          </div>
          
          <div className="md:col-span-2">
            <form onSubmit={handleSubmit}>
              <section id="account" className="mb-8">
                <h3 className="text-lg font-bold mb-4">Account Settings</h3>
                <div className="form-container">
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">Name</label>
                    <input type="text" id="name" className="form-input" defaultValue="User" />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email" className="form-label">Email</label>
                    <input type="email" id="email" className="form-input" defaultValue="user@example.com" />
                  </div>
                </div>
              </section>
              
              <section id="appearance" className="mb-8">
                <h3 className="text-lg font-bold mb-4">Appearance</h3>
                <div className="form-container">
                  <div className="form-group">
                    <label className="form-label">Theme</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input type="radio" name="theme" value="light" defaultChecked />
                        <span className="ml-2">Light</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="theme" value="dark" />
                        <span className="ml-2">Dark</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="theme" value="system" />
                        <span className="ml-2">System</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>
              
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 