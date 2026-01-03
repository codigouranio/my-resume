import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage() {
  return (
    <div className="landing-container">
      {/* Navigation Bar */}
      <div className="navbar bg-base-100 shadow-lg fixed top-0 z-50">
        <div className="navbar-start">
          <Link to="/" className="btn btn-ghost normal-case text-xl flex items-center gap-2">
            <img src="/logo.png" alt="RC" className="w-8 h-8" />
            <span style={{ color: '#00C2CB', fontWeight: 700 }}>ResumeCast</span>
            <span style={{ color: '#007BFF', fontWeight: 700 }}>.ai</span>
          </Link>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            <li><Link to="/pricing">Pricing</Link></li>
          </ul>
        </div>
        <div className="navbar-end gap-2">
          <Link to="/login" className="btn btn-ghost">Login</Link>
          <Link to="/register" className="btn btn-primary">Get Started</Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-screen bg-gradient-to-br from-primary to-secondary pt-16">
        <div className="hero-content text-center text-primary-content">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-bold mb-6">
              Create Your Professional Resume
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Build, customize, and share stunning resumes with AI-powered assistance.
              Stand out from the crowd with our intelligent resume platform.
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
                <div className="text-5xl mb-4">✨</div>
                <h3 className="card-title">AI-Powered Chat</h3>
                <p>Get instant help and suggestions from our AI assistant trained on your career details</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🎨</div>
                <h3 className="card-title">Beautiful Templates</h3>
                <p>Choose from professionally designed templates that make your resume stand out</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🔗</div>
                <h3 className="card-title">Shareable Links</h3>
                <p>Get a custom URL for your resume and share it anywhere with ease</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📝</div>
                <h3 className="card-title">Markdown Editor</h3>
                <p>Write your resume in Markdown with live preview for instant feedback</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🔒</div>
                <h3 className="card-title">Privacy Control</h3>
                <p>Choose who can see your resume - public, private, or unlisted</p>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="card-title">Analytics</h3>
                <p>Track views and engagement on your resume to understand your reach</p>
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
      <footer className="footer footer-center p-10 bg-base-200 text-base-content">
        <div>
          <p className="font-bold text-lg">
            <span style={{ color: '#00C2CB' }}>Resume</span>
            <span style={{ color: '#007BFF' }}>Cast.ai</span>
          </p>
          <p>Professional Resume Builder © 2025</p>
        </div>
      </footer>
    </div>
  );
}
