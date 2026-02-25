import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage() {
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  return (
    <div className="landing-container">
      {/* Header Navigation */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Link to="/search" className="btn btn-circle btn-outline btn-accent text-white border-white hover:bg-white hover:text-primary" aria-label="Search">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </Link>
        <Link to="/login" className="btn btn-circle btn-outline btn-accent text-white border-white hover:bg-white hover:text-primary" aria-label="Login">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-screen bg-gradient-to-br from-primary to-secondary">
        <div className="hero-content text-center text-primary-content">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-bold mb-6">
              Build Your Resume Once, Evolve Forever
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Your Career on Autopilot: AI Resumes That Interview for You, Log Achievements Forever, and Unlock Recruiter Insights.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/register" className="btn btn-lg bg-black text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-gray-800 hover:shadow-xl transition-all duration-200" data-discover="true">
                Get Started Free
              </Link>
              <Link to="/pricing" className="btn btn-lg bg-transparent text-black border-2 border-black px-8 py-4 rounded-lg font-semibold text-lg hover:bg-black hover:text-white transition-all duration-200" data-discover="true">
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section py-20 bg-base-200">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">Why Choose ResumeCast.ai?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="card-title">Recruiter-Facing AI Avatar</h3>
                <p>Let your personal AI representative answer questions 24/7 using public resume + private hidden context professional responses without ever exposing your notes. Recruiters chat instantly; you sleep.</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📖</div>
                <h3 className="card-title">Lifelong Private Career Log</h3>
                <p>Keep a detailed record of your career achievements and milestones, accessible anytime for personal growth and reflection.</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h3 className="card-title">Full Privacy & Rule-Based Control</h3>
                <p>Private data stays encrypted and never shown GDPR-compliant and secure.</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="card-title">Market Feedback Dashboard</h3>
                <p>See exactly what recruiters ask about you, top topics, skill gaps, and personalized learning suggestions to accelerate your next offer.</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🎨</div>
                <h3 className="card-title">Stunning Professional Templates</h3>
                <p>Choose from designer-crafted templates that render beautifully on web and PDF make your resume stand out while staying fully ATS-friendly.</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">👥</div>
                <h3 className="card-title">Multi-Faceted Resume Versions</h3>
                <p>Create unlimited tailored resumes for different roles or industries share one unified private AI context and bitácora across all versions for smarter, consistent avatar responses.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="cta-section py-20 bg-primary text-primary-content">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Build Your Resume?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of professionals who trust ResumeCast.ai
          </p>
          <Link to="/register" className="btn btn-lg btn-neutral">
            Create Your Free Account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer p-10 bg-base-200 text-base-content">
        <div className="w-full flex flex-col gap-2 items-start md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-lg">
              <span style={{ color: '#00C2CB' }}>Resume</span>
              <span style={{ color: '#007BFF' }}>Cast.ai</span>
            </p>
            <p>Professional Resume Builder © 2025</p>
          </div>
          <p className="text-xs opacity-60">UI v{appVersion}</p>
        </div>
      </footer>
    </div>
  );
}
