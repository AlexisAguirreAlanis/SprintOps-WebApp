import React, { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const VIEW_EASE = [0.16, 1, 0.3, 1];

function isSprintHome(pathname) {
  return /^\/sprint\/[^/]+\/?$/.test(pathname);
}

function isSprintView(pathname) {
  return /^\/sprint\/[^/]+(\/.*)?$/.test(pathname);
}

function AppStage({ context }) {
  const location = useLocation();
  const outlet = useOutlet(context);
  const reduce = useReducedMotion();
  const sprintHome = isSprintHome(location.pathname);
  const sprintView = isSprintView(location.pathname);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={location.pathname}
        className={sprintView
          ? 'absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden'
          : 'flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto'}
        initial={sprintHome && !reduce ? { opacity: 0, y: 18, scale: 0.985 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={sprintHome && !reduce
          ? { opacity: 0, y: -14, scale: 0.985, pointerEvents: 'none', transition: { duration: 0.26, ease: VIEW_EASE } }
          : { opacity: 1, transition: { duration: 0 } }}
        transition={{ duration: 0.4, ease: VIEW_EASE }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}

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
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <AppStage context={{ searchQuery, setSearchQuery }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
