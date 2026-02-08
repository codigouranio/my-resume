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
              Create Your Professional Resume
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Build, customize, and share stunning resumes with intelligent AI assistance. Make your resume interactive with our specialized AI agent storyteller, transforming your experience into compelling narratives that captivate recruiters and accelerate job offers.
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
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="card-title">AI-Powered Search</h3>
                <p>Find the perfect candidate with semantic search that understands skills and experience</p>
              </div>
            </div>

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
          <p className="text-xs opacity-60">UI v{appVersion}</p>
        </div>
      </footer>
    </div>
  );
}
