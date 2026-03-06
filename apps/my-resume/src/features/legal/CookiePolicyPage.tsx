import { Link } from 'react-router-dom';

export function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-300 shadow-lg">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost normal-case text-xl">
            ResumeCast.ai
          </Link>
        </div>
        <div className="flex-none">
          <Link to="/" className="btn btn-ghost">
            ← Back to Home
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-sm text-base-content/60 mb-8">Last Updated: March 6, 2026</p>

        <div className="prose max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that are placed on your device when you visit our website. They help us
              provide you with a better experience by remembering your preferences and understanding how you use our
              Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Types of Cookies We Use</h2>

            <h3 className="text-xl font-semibold mt-4 mb-2">Essential Cookies</h3>
            <p>These cookies are necessary for the Service to function properly:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Authentication Tokens:</strong> JWT tokens stored in localStorage to maintain your login session
              </li>
              <li>
                <strong>Session Management:</strong> Temporary cookies to manage your browsing session
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Preference Cookies</h3>
            <p>These cookies remember your choices and preferences:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Theme Selection:</strong> Stores your light/dark mode preference
              </li>
              <li>
                <strong>Language Settings:</strong> Remembers your language preference
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Analytics Cookies</h3>
            <p>These cookies help us understand how you use our Service:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Google Analytics:</strong> Tracks page views, user behavior, and traffic sources
              </li>
              <li>
                <strong>Resume Analytics:</strong> Tracks how many times your resume is viewed
              </li>
              <li>
                <strong>Chat Analytics:</strong> Tracks interactions with the AI chat assistant
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Marketing Cookies</h3>
            <p>These cookies are used for advertising and marketing purposes:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Google Tag Manager:</strong> Manages marketing and analytics tags
              </li>
              <li>
                <strong>Conversion Tracking:</strong> Tracks sign-ups and subscription conversions
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. Third-Party Cookies</h2>
            <p>We use services from third parties that may also set cookies on your device:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Stripe:</strong> For secure payment processing
              </li>
              <li>
                <strong>Google Analytics:</strong> For website analytics
              </li>
              <li>
                <strong>Google Tag Manager:</strong> For managing tracking scripts
              </li>
            </ul>
            <p className="mt-4">
              These third parties have their own privacy policies governing their use of cookies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Local Storage</h2>
            <p>In addition to cookies, we use browser local storage to store:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>JWT authentication tokens</li>
              <li>Theme preferences (light/dark mode)</li>
              <li>Temporary form data (to prevent loss during navigation)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. How to Control Cookies</h2>
            <p>You can control and manage cookies in several ways:</p>

            <h3 className="text-xl font-semibold mt-4 mb-2">Browser Settings</h3>
            <p>
              Most browsers allow you to refuse or delete cookies. The methods for doing so vary from browser to
              browser. Please visit your browser's help menu for instructions.
            </p>

            <h3 className="text-xl font-semibold mt-4 mb-2">Opt-Out Tools</h3>
            <ul className="list-disc ml-6 mt-2">
              <li>
                Google Analytics:{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  Browser Opt-Out Add-on
                </a>
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Note on Essential Cookies</h3>
            <p>
              If you block essential cookies, some features of the Service may not work properly, including the ability
              to log in and use authenticated features.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Cookie Duration</h2>
            <p>Cookies may be session-based (deleted when you close your browser) or persistent (stored for a set period):</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Session Cookies:</strong> Deleted when you close your browser
              </li>
              <li>
                <strong>Authentication Tokens:</strong> Expire after 7 days of inactivity
              </li>
              <li>
                <strong>Preference Cookies:</strong> Stored for up to 1 year
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Stored for up to 2 years
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our practices or for legal
              reasons. We encourage you to review this policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Contact Us</h2>
            <p>
              If you have questions about our use of cookies, please contact us at:{' '}
              <a href="mailto:privacy@resumecast.ai" className="link link-primary">
                privacy@resumecast.ai
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. More Information</h2>
            <p>For more information about how we handle your data, please see our:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <Link to="/privacy-policy" className="link link-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/user-agreement" className="link link-primary">
                  User Agreement
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
