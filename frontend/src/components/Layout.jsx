import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell flex h-full min-h-0 flex-col">
      <Navbar
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        onOpenNav={() => setNavOpen(true)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <main className="app-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={{ background: 'var(--app-bg)' }}>
          <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <Outlet context={{ searchQuery, setSearchQuery }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
