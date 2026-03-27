import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage() {
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  return (
    <div className="landing-container">
      {/* Header Navigation */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <Link
          to="/search"
          className="btn btn-circle btn-outline border-neutral-700 text-neutral-700 hover:bg-neutral-700 hover:text-white hover:border-neutral-700 dark:border-neutral-300 dark:text-neutral-300 dark:hover:bg-neutral-300 dark:hover:text-neutral-900"
          aria-label="Search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </Link>
        <Link
          to="/login"
          className="btn btn-circle btn-outline border-neutral-700 text-neutral-700 hover:bg-neutral-700 hover:text-white hover:border-neutral-700 dark:border-neutral-300 dark:text-neutral-300 dark:hover:bg-neutral-300 dark:hover:text-neutral-900"
          aria-label="Login"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </Link>
      </div>

      {/* Hero Section */}
      <div className="hero min-h-screen bg-gradient-to-br from-[#3b82f6] via-[#8b5cf6] to-[#ec4899]">
        <div className="hero-content text-center text-white">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-bold mb-6">
              Your Career Record. Your Proof. Your Story.
            </h1>
            <p className="text-xl mb-8 opacity-90">
              It's a career operating system.
              Capture your milestones like social posts, achievements, and experiences track your growth over years,
              publish multiple targeted resumes, and power an AI storyteller with rich private context that never appears
              in your public profile.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-lg bg-white text-gray-900 px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-gray-100 hover:shadow-xl transition-all duration-200"
                data-discover="true"
              >
                Start Your Career Record
              </Link>
              <Link
                to="/pricing"
                className="btn btn-lg bg-transparent text-white border-2 border-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-gray-900 transition-all duration-200"
                data-discover="true"
              >
                See PRO Plan
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section py-20 bg-base-200">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">
            Why This Is Different
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🧭</div>
                <h3 className="card-title">Career Timeline, Not File Storage</h3>
                <p>
                  Keep a living history of your career with timestamped entries,
                  wins, projects, outcomes, and lessons. Your profile grows with
                  you instead of being rewritten from scratch every time.
                </p>
              </div>
            </div>

            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📝</div>
                <h3 className="card-title">Social-Style Career Posts</h3>
                <p>
                  Publish short career updates internally like a professional
                  feed: launches, promotions, certifications, metrics, and key
                  decisions. Build evidence over time, not hype.
                </p>
              </div>
            </div>

            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="card-title">Multiple Resumes, One Source of Truth</h3>
                <p>
                  Create role-specific resumes for different opportunities while
                  reusing the same verified career record. Share the right
                  version with each recruiter without losing consistency.
                </p>
              </div>
            </div>

            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="card-title">Private AI Storyteller Context</h3>
                <p>
                  Store the details that do not fit a public resume, then let AI
                  use that private context to answer recruiter questions with
                  depth, while keeping private notes hidden.
                </p>
              </div>
            </div>

            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="card-title">Recruiter Signal Analytics</h3>
                <p>
                  See what questions recruiters ask, where interest drops, and
                  which skills get attention. Improve positioning with evidence,
                  not guesswork.
                </p>
              </div>
            </div>

            <div className="card bg-base-100">
              <div className="card-body items-center text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h3 className="card-title">Public Profile + Private Intelligence</h3>
                <p>
                  Your public resume stays clean and recruiter-friendly. Your
                  private context stays protected and only informs AI responses
                  under your rules.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-20 bg-base-100">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">
            Built for Every Career Stage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title">Students & New Graduates</h3>
                <p>
                  Turn internships, projects, and coursework into a credible
                  career narrative before your first full-time role.
                </p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title">Mid-Career Professionals</h3>
                <p>
                  Track impact, manage multiple role-focused resumes, and stay
                  ready for better opportunities without last-minute rewrites.
                </p>
              </div>
            </div>
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title">Senior Leaders & Experts</h3>
                <p>
                  Preserve institutional knowledge, leadership outcomes, and
                  strategic decisions in a durable record that recruiters can
                  understand fast.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-20 bg-base-300">
        <div className="container mx-auto px-4 text-center max-w-4xl">
          <h2 className="text-4xl font-bold mb-6">
            Not Another “AI Resume Builder”
          </h2>
          <p className="text-lg opacity-80">
            Most tools generate one polished document and stop there. ResumeCast.ai
            is a long-term SaaS product for career records, evidence, and
            recruiter-facing AI storytelling at scale.
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="cta-section py-20 bg-primary text-primary-content">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Own Your Career Data?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Start free. Upgrade to PRO when you need deeper analytics,
            multi-resume strategy, and always-on AI storytelling.
          </p>
          <Link to="/register" className="btn btn-lg btn-neutral">
            Create Free Account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer p-10 bg-base-200 text-base-content">
        <div className="w-full flex flex-col gap-2 items-start md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-lg">
              <span style={{ color: '#525252', fontWeight: 700 }}>Resume</span>
              <span style={{ color: '#383838', fontWeight: 700 }}>Cast.ai</span>
            </p>
            <p>Career Intelligence Platform © 2025</p>
          </div>
          <p className="text-xs opacity-60">UI v{appVersion}</p>
        </div>
      </footer>
    </div>
  );
}
