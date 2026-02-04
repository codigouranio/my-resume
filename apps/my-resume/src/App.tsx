import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/contexts/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LandingPage } from './features/landing';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './features/auth';
import { DashboardPage } from './features/dashboard';
import { EditorPage } from './features/editor';
import { PricingPage } from './features/pricing';
import { SettingsPage } from './features/settings';
import { SearchPage } from './features/search';
import Resume from './features/resume/Resume';
import VersionBadge from './shared/components/VersionBadge';
import './shared/styles/App.css';

// Check if we're on a custom subdomain
function getCustomSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Get base domain from env or use default
  const baseDomain = import.meta.env.PUBLIC_BASE_DOMAIN || 'resumecast.ai';

  // Skip subdomain detection for localhost and IPs
  if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }

  // Check if it's the main domain or www variant
  if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return null;
  }

  // Check if hostname ends with base domain (is a subdomain of it)
  if (hostname.endsWith(`.${baseDomain}`)) {
    // Extract the subdomain part (everything before .baseDomain)
    const subdomain = hostname.slice(0, -(baseDomain.length + 1));

    // Make sure it's a single-level subdomain (no dots in the subdomain part)
    if (!subdomain.includes('.') && subdomain.length > 0) {
      return subdomain;
    }
  }

  return null;
}

const App = () => {
  const customSubdomain = getCustomSubdomain();

  // If on custom subdomain, show only the resume
  if (customSubdomain) {
    return (
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Resume customDomain={customSubdomain} />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/resume/:slug" element={<Resume />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor/:id"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <VersionBadge />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
