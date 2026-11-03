import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import AppRouter from './router/AppRouter';
import AppFrame from './components/AppFrame';
import { AuthProvider } from './features/auth/hooks/useAuth';
import AppScrollbar from './components/AppScrollbar';
import './styles/globals.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppFrame>
          <Toaster richColors position="top-right" />
          <AppRouter />
          <AppScrollbar />
        </AppFrame>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
