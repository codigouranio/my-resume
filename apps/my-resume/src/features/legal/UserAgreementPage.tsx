import { Link } from 'react-router-dom';

export function UserAgreementPage() {
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
        <h1 className="text-4xl font-bold mb-2">User Agreement</h1>
        <p className="text-sm text-base-content/60 mb-8">Last Updated: March 6, 2026</p>

        <div className="prose max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ResumeCast.ai ("Service"), you accept and agree to be bound by the terms and
              provisions of this agreement. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
            <p>
              ResumeCast.ai provides an AI-powered resume building and management platform that allows users to create,
              edit, publish, and share professional resumes. The Service includes features such as:
            </p>
            <ul className="list-disc ml-6 mt-2">
              <li>Resume creation and editing tools</li>
              <li>AI-powered chat assistance for resume optimization</li>
              <li>Resume analytics and performance tracking</li>
              <li>Custom subdomain and domain support</li>
              <li>Recruiter interest tracking</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
            <p>
              To use our Service, you must create an account. You are responsible for maintaining the confidentiality
              of your account credentials and for all activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc ml-6 mt-2">
              <li>Provide accurate and complete information during registration</li>
              <li>Keep your password secure and confidential</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Be responsible for all activity on your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">4. User Content</h2>
            <p>
              You retain ownership of all content you create and upload to the Service. By uploading content, you grant
              ResumeCast.ai a worldwide, non-exclusive, royalty-free license to use, reproduce, and display your content
              solely for the purpose of providing and improving the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">5. Subscription and Payment</h2>
            <p>
              Some features of the Service require a paid subscription. By subscribing to a paid plan, you agree to pay
              the applicable fees. Subscriptions automatically renew unless canceled. Refunds are provided in accordance
              with our refund policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">6. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc ml-6 mt-2">
              <li>Use the Service for any illegal purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Infringe on intellectual property rights</li>
              <li>Upload malicious code or viruses</li>
              <li>Attempt to gain unauthorized access to the Service</li>
              <li>Use the Service to spam or harass others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">7. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of this agreement or
              for any other reason. You may cancel your account at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. We do not guarantee that the Service will
              be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">9. Limitation of Liability</h2>
            <p>
              ResumeCast.ai shall not be liable for any indirect, incidental, special, consequential, or punitive damages
              resulting from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of material changes via email
              or through the Service. Your continued use of the Service after changes constitutes acceptance of the
              modified terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this User Agreement, please contact us at:{' '}
              <a href="mailto:legal@resumecast.ai" className="link link-primary">
                legal@resumecast.ai
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
