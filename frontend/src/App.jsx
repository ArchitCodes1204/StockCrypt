import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import Research from './components/Research';
import Watchlist from './components/Watchlist';
import Insights from './components/Insights';
import Portfolio from './components/Portfolio';
import Screener from './components/Screener';
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import { AppShell } from './components/layout/AppShell';

// Design-system kitchen sink, only in development builds.
const DevUiPreview = import.meta.env.DEV ? lazy(() => import('./components/dev/DevUiPreview')) : null;

const App = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/portfolio" element={<Portfolio />} />
                  <Route path="/research" element={<Research />} />
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/screener" element={<Screener />} />
                  <Route path="/insights" element={<Insights />} />
                  {DevUiPreview && (
                    <Route
                      path="/dev/ui"
                      element={<Suspense fallback={null}><DevUiPreview /></Suspense>}
                    />
                  )}
                </Route>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
