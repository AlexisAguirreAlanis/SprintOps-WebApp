import { useState, useEffect, useContext, createContext, useCallback, useRef, createElement } from 'react';
import apiClient from '../../../data/api/apiClient';

const normalizeRole = (backendRole) => {
  const map = {
    'Developer': 'developer',
    'Scrum Master': 'scrumMaster',
    'Product Owner': 'productOwner',
  };
  return map[backendRole] || backendRole;
};

// Map from frontend normalized role name to backend role name
const roleNameMap = {
  'developer': 'Developer',
  'scrumMaster': 'Scrum Master',
  'productOwner': 'Product Owner',
};

const AuthContext = createContext(null);

const clearStoredAuth = () => {
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_permissions');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  const [authReady, setAuthReady] = useState(() => !localStorage.getItem('auth_user'));

  const [permissions, setPermissions] = useState(() => {
    const stored = localStorage.getItem("auth_permissions");
    if (stored) {
      try { return JSON.parse(stored); } catch { return {}; }
    }
    return {};
  });

  /** Evita que callbacks que dependían de `user` cambien en cada render y disparen useEffects en bucle */
  const userRef = useRef(user);
  userRef.current = user;

  // Fetch permissions from backend for the user's role
  const loadPermissions = useCallback(async (role) => {
    try {
      const allRoles = await apiClient.get('/roles');
      const backendName = roleNameMap[role] || role;
      const matched = allRoles.find(r =>
        r.nombreRol === backendName ||
        r.nombreRol.toLowerCase().replace(/\s+/g, '') === role.toLowerCase().replace(/\s+/g, '')
      );
      if (matched) {
        const permisos = await apiClient.get(`/roles/${matched.idRol}/permisos`);
        const permMap = {};
        permisos.forEach(p => { permMap[p.nombrePermiso] = true; });
        setPermissions(permMap);
        localStorage.setItem("auth_permissions", JSON.stringify(permMap));
      } else {
        setPermissions({});
        localStorage.setItem("auth_permissions", JSON.stringify({}));
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
    }
  }, []);

  // Si hay sesión guardada, comprobar que el usuario sigue existiendo en el backend
  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem('auth_user');
    if (!stored) {
      setAuthReady(true);
      return undefined;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(stored);
    } catch {
      clearStoredAuth();
      setUser(null);
      setPermissions({});
      if (!cancelled) setAuthReady(true);
      return undefined;
    }
    if (!parsed?.id) {
      clearStoredAuth();
      setUser(null);
      setPermissions({});
      if (!cancelled) setAuthReady(true);
      return undefined;
    }
    (async () => {
      try {
        await apiClient.get(`/usuarios/${parsed.id}`);
        if (!cancelled) setAuthReady(true);
      } catch {
        clearStoredAuth();
        if (!cancelled) {
          setUser(null);
          setPermissions({});
          setAuthReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always re-fetch permissions on mount to stay in sync with backend
  useEffect(() => {
    if (user?.role) {
      loadPermissions(user.role);
    }
  }, [user?.role, loadPermissions]);

  const login = async (email, password) => {
    const userData = await apiClient.post('/auth/login', { email, password });
    userData.role = normalizeRole(userData.role);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setUser(userData);
    await loadPermissions(userData.role);
    return userData;
  };

  const completeOAuthLogin = useCallback(async (userData) => {
    userData.role = normalizeRole(userData.role);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    setUser(userData);
    await loadPermissions(userData.role);
    return userData;
  }, [loadPermissions]);

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setPermissions({});
  };

  const checkPermission = useCallback((action) => {
    if (!user) return false;
    return !!permissions[action];
  }, [user, permissions]);

  const refreshPermissions = useCallback((newRole) => {
    if (newRole && user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
      loadPermissions(newRole);
    } else if (user?.role) {
      loadPermissions(user.role);
    }
  }, [user, loadPermissions]);

  // Load permissions based on the user's role in a specific project
  const refreshPermissionsForProject = useCallback(async (projectId) => {
    const u = userRef.current;
    if (!u?.id) return;
    try {
      const members = await apiClient.get(`/proyectos/${projectId}/miembros`);
      const me = members.find(m => m.userId === u.id);
      if (me?.role) {
        setUser(prev => {
          if (!prev) return prev;
          if (prev.role === me.role) return prev;
          const next = { ...prev, role: me.role };
          localStorage.setItem("auth_user", JSON.stringify(next));
          return next;
        });
        await loadPermissions(me.role);
      }
    } catch (err) {
      console.error('Error loading project permissions:', err);
    }
  }, [loadPermissions]);

  const isAuthenticated = !!user;

  const value = {
    user,
    login,
    completeOAuthLogin,
    logout,
    authReady,
    isAuthenticated,
    checkPermission,
    refreshPermissions,
    refreshPermissionsForProject,
  };

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
