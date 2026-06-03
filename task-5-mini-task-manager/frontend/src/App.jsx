/**
 * ARCHITECTURAL NOTE — Route Guards
 * ===================================
 * `ProtectedRoute` redirects unauthenticated users to /login.
 * `PublicRoute` redirects already-authenticated users to / (prevents
 * accessing login/signup when already logged in).
 *
 * Both guards wait for `loading` to be false before deciding — this
 * prevents a flicker where an authenticated user momentarily sees the
 * login page before the `/auth/me` response arrives.
 *
 * React Router v6's `<Navigate replace>` replaces the history entry so
 * the browser back button doesn't loop the user back to the redirect.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './views/Dashboard';
import Login from './views/Login';
import Signup from './views/Signup';

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center text-gray-400 text-sm">
      Loading…
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
