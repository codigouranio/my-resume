import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './shared/contexts/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LandingPage } from './features/landing';
import { LoginPage, RegisterPage } from './features/auth';
import { DashboardPage } from './features/dashboard';
import { EditorPage } from './features/editor';
import { PricingPage } from './features/pricing';
import { SettingsPage } from './features/settings';
import { SearchPage } from './features/search';
import Resume from './features/resume/Resume';
import './shared/styles/App.css';

// Check if we're on a custom subdomain
function getCustomSubdomain(): string | null {
  const hostname = window.location.hostname;

  // Check if it's a subdomain (not main domain)
  if (hostname !== 'resumecast.ai' &&
    hostname !== 'www.resumecast.ai' &&
    hostname !== 'localhost' &&
    !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) { // Not IP address

    // Extract subdomain
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[parts.length - 2] === 'resumecast') {
      return parts[0]; // Return the subdomain part
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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
