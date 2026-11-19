import React, { useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '../../data/api/apiClient';
import { useAuth } from '../auth/hooks/useAuth';
import LoginForm from './LoginForm';

const LoginPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeOAuthLogin, authReady } = useAuth();
  const oauthStarted = useRef(false);

  useEffect(() => {
    const err = searchParams.get('oauth_error');
    if (err) {
      if (err === 'not_configured') {
        toast.error('OAuth no está activo en el backend.', {
          description:
            'Define GOOGLE_CLIENT_* y/o GITHUB_CLIENT_* en variables de entorno o application-local.properties, reinicia Spring Boot y vuelve a intentar.',
          duration: 8000,
        });
      } else if (err === 'no_email') {
        toast.error('Google no devolvió un correo. Prueba otra cuenta o usa correo y contraseña.');
      } else {
        toast.error('No pudimos usar tu cuenta de Google. Prueba de nuevo o usa correo y contraseña.');
      }
      const next = new URLSearchParams(searchParams);
      next.delete('oauth_error');
      setSearchParams(next, { replace: true });
      return;
    }
    const code = searchParams.get('oauthCode');
    if (!code || oauthStarted.current) return;
    oauthStarted.current = true;
    (async () => {
      try {
        const dto = await apiClient.post('/auth/oauth-exchange', { code });
        await completeOAuthLogin(dto);
        const next = new URLSearchParams(searchParams);
        next.delete('oauthCode');
        setSearchParams(next, { replace: true });
        navigate('/home', { replace: true });
      } catch (e) {
        oauthStarted.current = false;
        toast.error(e.message || 'Error al completar el login con Google');
        const next = new URLSearchParams(searchParams);
        next.delete('oauthCode');
        setSearchParams(next, { replace: true });
      }
    })();
  }, [searchParams, setSearchParams, navigate, completeOAuthLogin]);

  if (!authReady) {
    return (
      <div className="flex h-full flex-col bg-[#F0EFED] font-sans">
        <header className="w-full h-[80px] bg-[#2B2B2B] flex items-center justify-center shrink-0 shadow-sm px-4">
          <img
            src="/logo-pistache.svg"
            alt="Pistache"
            className="h-14 w-auto max-h-[64px] object-contain"
          />
        </header>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#F0EFED] font-sans">
      {/* Header Section */}
      <header className="w-full h-[80px] bg-[#2B2B2B] flex items-center justify-center shrink-0 shadow-sm px-4">
        <img
          src="/logo-pistache.svg"
          alt="Pistache"
          className="h-14 w-auto max-h-[64px] object-contain"
        />
      </header>

      {/* Main Content - Centered Card */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="relative box-border w-full max-w-[400px] rounded-[24px] bg-white px-8 pb-8 pt-14 shadow-md">
          <div className="absolute left-1/2 top-0 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[#67BFA1] shadow-lg">
            <User size={34} strokeWidth={2.25} className="text-white" />
          </div>
          <LoginForm />
        </div>
      </main>
      
      {/* Invisible footer to balance the layout if needed */}
      <footer className="h-[20px] shrink-0" />
    </div>
  );
};

export default LoginPage;
