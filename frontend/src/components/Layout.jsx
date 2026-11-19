import React, { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const VIEW_EASE = [0.22, 1, 0.36, 1];

function isSprintHome(pathname) {
  return /^\/sprint\/[^/]+\/?$/.test(pathname);
}

function isSprintView(pathname) {
  return /^\/sprint\/[^/]+(\/.*)?$/.test(pathname);
}

function isProjectSprints(pathname) {
  return /^\/project\/[^/]+\/sprints\/?$/.test(pathname);
}

function usesDrillTransition(pathname) {
  return isSprintHome(pathname) || isProjectSprints(pathname);
}

function usesOverlayLayout(pathname) {
  return isSprintView(pathname) || isProjectSprints(pathname);
}

function AppStage({ context }) {
  const location = useLocation();
  const outlet = useOutlet(context);
  const reduce = useReducedMotion();
  const drill = !reduce && usesDrillTransition(location.pathname);
  const overlay = usesOverlayLayout(location.pathname);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={location.pathname}
        className={overlay
          ? 'absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden'
          : 'flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto'}
        initial={drill ? { opacity: 0, y: 18 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={drill
          ? {
            opacity: 0,
            y: -14,
            pointerEvents: 'none',
            transition: { duration: 0.24, ease: VIEW_EASE },
          }
          : { opacity: 1, transition: { duration: 0 } }}
        transition={{ duration: 0.42, ease: VIEW_EASE }}
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