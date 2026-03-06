import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-base-content/60 mb-8">Last Updated: March 6, 2026</p>

        <div className="prose max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
            <p>We collect several types of information from and about users of our Service:</p>

            <h3 className="text-xl font-semibold mt-4 mb-2">Personal Information</h3>
            <ul className="list-disc ml-6">
              <li>Email address</li>
              <li>First and last name</li>
              <li>Phone number (optional)</li>
              <li>Payment information (processed securely through Stripe)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Resume Content</h3>
            <ul className="list-disc ml-6">
              <li>Resume text and formatting</li>
              <li>Work experience, education, and skills</li>
              <li>AI context and journal entries (private)</li>
              <li>Attachments and uploaded files</li>
            </ul>

            <h3 className="text-xl font-semibold mt-4 mb-2">Usage Information</h3>
            <ul className="list-disc ml-6">
              <li>Resume view counts and analytics</li>
              <li>Chat interactions with AI assistant</li>
              <li>IP address and browser information</li>
              <li>Pages visited and features used</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>Provide and maintain the Service</li>
              <li>Process your transactions and subscriptions</li>
              <li>Send you important updates and notifications</li>
              <li>Improve and personalize your experience</li>
              <li>Analyze usage patterns and optimize performance</li>
              <li>Provide AI-powered features and recommendations</li>
              <li>Respond to your requests and support inquiries</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. How We Share Your Information</h2>
            <p>We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>
                <strong>Service Providers:</strong> Third-party vendors who help us operate the Service (e.g., hosting,
                payment processing, analytics)
              </li>
              <li>
                <strong>AI Services:</strong> Your resume content may be processed by AI models to provide chat and
                optimization features
              </li>
              <li>
                <strong>Recruiters:</strong> Only if you explicitly choose to make your resume public or share it via
                custom domain
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to protect our rights
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information,
              including:
            </p>
            <ul className="list-disc ml-6 mt-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication using JWT tokens</li>
              <li>Regular security audits and updates</li>
              <li>Limited access to personal data by authorized personnel</li>
              <li>Secure payment processing through Stripe</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Your Privacy Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
              <li>Control privacy settings for your resumes</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:privacy@resumecast.ai" className="link link-primary">
                privacy@resumecast.ai
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Cookies and Tracking</h2>
            <p>
              We use cookies and similar tracking technologies to improve your experience. See our{' '}
              <Link to="/cookie-policy" className="link link-primary">
                Cookie Policy
              </Link>{' '}
              for more details.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide the
              Service. When you delete your account, we will delete your personal information within 30 days, except
              where retention is required by law.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal
              information from children under 13.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence.
              We ensure appropriate safeguards are in place to protect your data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by email or
              through the Service. Your continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:privacy@resumecast.ai" className="link link-primary">
                privacy@resumecast.ai
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
