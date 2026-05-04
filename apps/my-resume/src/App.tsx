import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './shared/contexts/AuthContext';
import { AIContextProvider } from './shared/contexts/AIContextContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AdminRoute } from './features/auth/AdminRoute';
import { LandingPage } from './features/landing';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from './features/auth';
import { UserAgreementPage, PrivacyPolicyPage, CookiePolicyPage } from './features/legal';
import { BackofficePage } from './features/backoffice';
import { DashboardPage } from './features/dashboard';
import { EditorPage } from './features/editor';
import { PricingPage } from './features/pricing';
import { SettingsPage } from './features/settings';
import { SearchPage } from './features/search';
import { PublicJournalPage } from './features/public-journal';
import { VerifyCorroborationPage } from './features/corroboration/VerifyCorroborationPage';
import Resume from './features/resume/Resume';
import VersionBadge from './shared/components/VersionBadge';
import './shared/styles/App.css';

// Check if we're on a custom subdomain
function getCustomSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Get base domain from env or use default
  const baseDomain = import.meta.env.PUBLIC_BASE_DOMAIN || 'resumecast.ai';
  const reservedHostnames = (import.meta.env.PUBLIC_RESERVED_HOSTNAMES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // Skip subdomain detection for localhost and IPs
  if (hostname === 'localhost' || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    return null;
  }

  if (reservedHostnames.includes(hostname)) {
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

  // Set global default theme on app load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // If on custom subdomain, show only the resume
  if (customSubdomain) {
    return (
      <AuthProvider>
        <AIContextProvider>
          <BrowserRouter>
            <Routes>
              <Route path="*" element={<Resume customDomain={customSubdomain} />} />
            </Routes>
          </BrowserRouter>
        </AIContextProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AIContextProvider>
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
            <Route path="/journal/:userId" element={<PublicJournalPage />} />
            <Route path="/verify/corroboration/:token" element={<VerifyCorroborationPage />} />

            {/* Legal Pages */}
            <Route path="/user-agreement" element={<UserAgreementPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/cookie-policy" element={<CookiePolicyPage />} />

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
              path="/backoffice"
              element={
                <AdminRoute>
                  <BackofficePage />
                </AdminRoute>
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
      </AIContextProvider>
    </AuthProvider>
  );
};

export default App;
