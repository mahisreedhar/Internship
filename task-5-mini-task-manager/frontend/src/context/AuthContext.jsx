/**
 * ARCHITECTURAL NOTE — Global Auth Context
 * =========================================
 * React's Context API gives every descendant access to the authenticated
 * user without prop-drilling. On first mount, `GET /auth/me` is called —
 * if the HttpOnly cookie is present and valid, the backend returns the user
 * object; if not (cookie absent, expired, or tampered), we get a 401 and
 * set `user` to null. This replaces the anti-pattern of reading a token
 * from localStorage on startup (which is vulnerable to XSS).
 *
 * The `loading` flag prevents child routes from rendering (and redirecting)
 * before the auth check completes, eliminating the flash-of-wrong-content
 * problem on hard refresh.
 *
 * `login` and `logout` are async actions that update both the server state
 * (cookie) and the local React state simultaneously — a single source of truth.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../hooks/useApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const userData = await api.post('/auth/login', { email, password });
    setUser(userData);
    return userData;
  };

  const signup = (email, password, full_name) =>
    api.post('/auth/signup', { email, password, full_name });

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
