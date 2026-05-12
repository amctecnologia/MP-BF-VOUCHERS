import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  login: (token: string, user: Omit<AuthUser, 'token'>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const u = localStorage.getItem('user');
      const t = localStorage.getItem('token');
      return u && t ? { ...JSON.parse(u), token: t } : null;
    } catch { return null; }
  });

  const login = (token: string, u: Omit<AuthUser, 'token'>) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser({ ...u, token });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
