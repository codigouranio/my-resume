import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { apiClient } from '../../shared/api/client';
import { getDisplayBaseDomain } from '../../shared/utils/domain';
import './PricingPage.css';

export function PricingPage() {
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  const { isAuthenticated, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceAmount, setPriceAmount] = useState<number | null>(null);
  const [priceInterval, setPriceInterval] = useState<string>('month');
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPrice = async () => {
      try {
        const data = await apiClient.getPriceDetails('SUBSCRIPTION_PRO');
        if (!isMounted) return;
        if (typeof data?.unitAmount === 'number') {
          setPriceAmount(data.unitAmount / 100);
        }
        if (data?.interval) {
          setPriceInterval(data.interval);
        }
      } catch (err) {
        console.error('Failed to load Stripe price', err);
      } finally {
        if (isMounted) {
          setPriceLoading(false);
        }
      }
    };

    loadPrice();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpgrade = async () => {
    if (!isAuthenticated) {
      // Redirect to register if not logged in
      window.location.href = '/register';
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.createCheckoutSession(STRIPE_PRICE_ID);

      // Redirect to Stripe Checkout
      if (response.url) {
        window.location.href = response.url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout');
      setIsLoading(false);
    }
  };

  const isPro = user?.subscriptionTier === 'PRO';

  return (
    <div className="pricing-container min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="btn btn-ghost normal-case text-xl">
            <span style={{ color: '#00C2CB', fontWeight: 700 }}>Resume</span>
            <span style={{ color: '#007BFF', fontWeight: 700 }}>Cast.ai</span>
          </Link>
        </div>
        <div className="flex-none gap-2">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero py-16 bg-gradient-to-br from-primary to-secondary text-primary-content">
        <div className="hero-content text-center">
          <div className="max-w-4xl">
            <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
            <p className="text-xl opacity-90">
              Start free, upgrade when you need professional features
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* FREE Tier */}
          <div className="card bg-base-100 shadow-xl border-2 border-base-300">
            <div className="card-body">
              <h2 className="card-title text-3xl justify-center">FREE</h2>
              <div className="text-center py-6">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-xl opacity-70">/month</span>
              </div>
              <p className="text-center text-sm opacity-70 mb-6">
                Perfect for getting started
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>Public resume at <code className="text-sm bg-base-200 px-2 py-1 rounded">{getDisplayBaseDomain()}/resume/yourname</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>AI-powered chat assistant</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>Basic analytics (view count)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>Professional templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>Markdown content editor</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success text-xl">✓</span>
                  <span>Mobile responsive design</span>
                </li>
              </ul>

              <div className="card-actions justify-center">
                <Link to="/register" className="btn btn-outline btn-primary btn-wide">
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>

          {/* PRO Tier */}
          <div className="card bg-primary text-primary-content shadow-2xl border-4 border-primary relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="badge badge-secondary badge-lg font-bold px-6 py-4">MOST POPULAR</span>
            </div>
            <div className="card-body">
              <h2 className="card-title text-3xl justify-center">PRO</h2>
              <div className="text-center py-6">
                <span className="text-5xl font-bold">
                  {priceLoading ? '$9' : `$${(priceAmount ?? 9).toFixed(0)}`}
                </span>
                <span className="text-xl opacity-70">/{priceInterval}</span>
              </div>
              <p className="text-center text-sm opacity-70 mb-6">
                For professionals who want to stand out
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="text-warning text-xl">★</span>
                  <span><strong>Custom subdomain:</strong> <code className="text-sm bg-primary-content/20 px-2 py-1 rounded">yourname.{getDisplayBaseDomain()}</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning text-xl">★</span>
                  <span><strong>Advanced Analytics:</strong> Visitor tracking, referral sources, session duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning text-xl">★</span>
                  <span>Geographic visitor insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning text-xl">★</span>
                  <span>Real-time analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="opacity-70 text-xl">✓</span>
                  <span className="opacity-70">All FREE features included</span>
                </li>
              </ul>

              {error && (
                <div className="alert alert-error shadow-lg mb-4">
                  <span>{error}</span>
                </div>
              )}

              <div className="card-actions justify-center mt-2">
                {isPro ? (
                  <div className="badge badge-lg badge-success">Current Plan</div>
                ) : (
                  <button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="btn btn-secondary btn-wide"
                  >
                    {isLoading ? (
                      <>
                        <span className="loading loading-spinner"></span>
                        Processing...
                      </>
                    ) : (
                      'Upgrade to PRO'
                    )}
                  </button>
                )}
              </div>

              {!isAuthenticated && (
                <p className="text-center text-xs opacity-60 mt-4">
                  Sign in or create an account to upgrade
                </p>
              )}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>

          <div className="space-y-4">
            <div className="collapse collapse-plus bg-base-200">
              <input type="radio" name="faq-accordion" defaultChecked />
              <div className="collapse-title text-xl font-medium">
                Can I start free and upgrade later?
              </div>
              <div className="collapse-content">
                <p>Absolutely! Start with our FREE tier and upgrade to PRO whenever you're ready. Your content and settings will be preserved.</p>
              </div>
            </div>

            <div className="collapse collapse-plus bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-xl font-medium">
                How does the custom subdomain work?
              </div>
              <div className="collapse-content">
                <p>With PRO, you get your own subdomain like <code>yourname.{getDisplayBaseDomain()}</code>. This gives you a professional, memorable URL to share with recruiters and on your LinkedIn profile.</p>
              </div>
            </div>

            <div className="collapse collapse-plus bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-xl font-medium">
                What analytics do I get with PRO?
              </div>
              <div className="collapse-content">
                <p>PRO tier includes detailed analytics: total views, unique visitors, referral sources (LinkedIn, Indeed, direct links), visitor location, session duration, and daily/weekly trends.</p>
              </div>
            </div>

            <div className="collapse collapse-plus bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-xl font-medium">
                Can I cancel anytime?
              </div>
              <div className="collapse-content">
                <p>Yes! You can cancel your PRO subscription at any time. You'll keep PRO features until the end of your billing period, then automatically switch to the FREE tier.</p>
              </div>
            </div>

            <div className="collapse collapse-plus bg-base-200">
              <input type="radio" name="faq-accordion" />
              <div className="collapse-title text-xl font-medium">
                Is my data secure?
              </div>
              <div className="collapse-content">
                <p>Absolutely. We use industry-standard encryption, secure authentication, and never sell your data. You have full control over your resume's visibility.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20 py-16 bg-base-200 rounded-box">
          <h2 className="text-4xl font-bold mb-4">Ready to Create Your Resume?</h2>
          <p className="text-xl opacity-70 mb-8">
            Join thousands of professionals showcasing their careers
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/register" className="btn btn-primary btn-lg">
              Start Free
            </Link>
            <Link to="/" className="btn btn-outline btn-lg">
              Learn More
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer footer-center p-10 bg-base-200 text-base-content mt-20">
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
