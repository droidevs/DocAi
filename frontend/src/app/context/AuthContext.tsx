import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { UserProfileResponse } from '../components/shared/types';

interface AuthState {
  token: string | null;
  user: UserProfileResponse | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: UserProfileResponse) => void;
  logout: () => void;
  updateUser: (user: UserProfileResponse) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'docai_user';

function loadState(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  let user: UserProfileResponse | null = null;
  try {
    if (userStr) user = JSON.parse(userStr);
  } catch {
    user = null;
  }
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;
  return { token, user, isAuthenticated: !!token && !!user, isAdmin };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  const login = useCallback((token: string, user: UserProfileResponse) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const isAdmin = user.roles?.includes('ROLE_ADMIN') ?? false;
    setState({ token, user, isAuthenticated: true, isAdmin });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, isAuthenticated: false, isAdmin: false });
  }, []);

  const updateUser = useCallback((user: UserProfileResponse) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    const isAdmin = user.roles?.includes('ROLE_ADMIN') ?? false;
    setState((prev) => ({ ...prev, user, isAdmin }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
