import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/hooks/useAuth';
import apiClient, { API_ORIGIN } from '../../data/api/apiClient';

const GoogleLogo = ({ className = 'shrink-0' }) => (
  <svg className={className} viewBox="0 0 24 24" width={20} height={20} aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const GitHubLogo = ({ className = 'shrink-0 text-white' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width={20}
    height={20}
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const LoginForm = () => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerDone, setRegisterDone] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterDone(null);
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register', { email, password });
      setRegisterDone(res);
      toast.success(res.message || 'Cuenta creada');
      if (!res.emailDispatched) {
        toast.message('Sin SMTP', {
          description: 'El enlace de verificación aparece en los logs del backend.',
        });
      }
    } catch (err) {
      setError(err.message || 'No se pudo registrar');
    } finally {
      setLoading(false);
    }
  };

  const startGoogleLogin = () => {
    window.location.href = `${API_ORIGIN}/oauth2/authorization/google`;
  };

  const startGitHubLogin = () => {
    window.location.href = `${API_ORIGIN}/oauth2/authorization/github`;
  };

  const fieldShell =
    'flex h-[50px] w-full min-w-0 items-center gap-2.5 rounded-[10px] border border-[#dcdcdc] bg-[#f9f9f9] px-3.5 transition-shadow focus-within:ring-1 focus-within:ring-[#67BFA1]';

  return (
    <div className="w-full min-w-0">
      <form
        onSubmit={mode === 'login' ? handleLogin : handleRegister}
        className="space-y-[15px]"
      >
        <div className={fieldShell}>
          <Mail size={20} className="shrink-0 text-gray-400" aria-hidden />
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Correo electrónico"
            className="login-field-input h-full min-w-0 flex-1 bg-transparent text-base text-[#312D2A] outline-none placeholder:text-gray-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className={fieldShell}>
          <Lock size={20} className="shrink-0 text-gray-400" aria-hidden />
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Contraseña"
            className="login-field-input h-full min-w-0 flex-1 bg-transparent text-base text-[#312D2A] outline-none placeholder:text-gray-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 6 : undefined}
          />
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-black/[0.04] hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#67BFA1]"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={showPassword ? 'off' : 'on'}
                className="flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.6, rotate: showPassword ? 10 : -10 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.6, rotate: showPassword ? -10 : 10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {showPassword ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

        {mode === 'register' && (
          <>
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#312D2A] pt-1">
              REGISTRATE CON
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={startGoogleLogin}
                className="flex-1 h-[44px] rounded-[10px] border border-[#dcdcdc] bg-white text-[#312D2A] font-semibold text-sm hover:bg-[#f5f5f5] transition-colors inline-flex items-center justify-center gap-2"
              >
                <GoogleLogo />
                Google
              </button>
              <span className="text-gray-400 text-sm font-medium px-1 shrink-0">|</span>
              <button
                type="button"
                onClick={startGitHubLogin}
                className="flex-1 h-[44px] rounded-[10px] border border-[#dcdcdc] bg-[#24292f] text-white font-semibold text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
              >
                <GitHubLogo />
                GitHub
              </button>
            </div>
          </>
        )}

        <div className="pt-[10px]">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] bg-[#67BFA1] text-white rounded-[10px] font-bold text-base hover:opacity-90 transition-opacity mt-4 disabled:opacity-60"
          >
            {loading
              ? mode === 'login'
                ? 'Iniciando...'
                : 'Registrando...'
              : mode === 'login'
                ? 'Iniciar Sesion'
                : 'Crear cuenta'}
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-[10px] text-center mt-2 font-bold uppercase tracking-wider">
            {error}
          </p>
        )}

        {registerDone && (
          <p className="text-[#67BFA1] text-[12px] text-center mt-2 font-semibold leading-snug">
            {registerDone.message}
          </p>
        )}
      </form>

      <div className="mt-5 text-center space-y-2">
        {mode === 'login' ? (
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setRegisterDone(null);
              setShowPassword(false);
            }}
            className="text-[#67BFA1] font-bold text-sm underline-offset-2 hover:underline"
          >
            Registrarse
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setRegisterDone(null);
              setShowPassword(false);
            }}
            className="text-[#67BFA1] font-bold text-sm underline-offset-2 hover:underline"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
