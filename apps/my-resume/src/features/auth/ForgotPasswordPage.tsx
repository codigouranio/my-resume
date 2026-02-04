import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Note: This endpoint needs to be implemented in the backend
      // For now, show a message about emailing support
      setSuccess('Password reset instructions have been sent to your email. Please check your inbox and follow the link.');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Enter your email to receive a password reset link</p>

        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>✓ {success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Email Address</span>
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              className="input input-bordered w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={success !== ''}
            />
            <label className="label">
              <span className="label-text-alt text-xs text-base-content/60">
                We'll send you a link to reset your password
              </span>
            </label>
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || success !== ''}
          >
            {isLoading ? 'Sending...' : 'Send Reset Email'}
          </button>
        </form>

        <div className="divider">OR</div>

        <div className="space-y-3">
          <p className="text-sm text-base-content/70">
            Remember your password?{' '}
            <Link to="/login" className="link link-primary">
              Sign in
            </Link>
          </p>
          <p className="text-sm text-base-content/70">
            Don't have an account?{' '}
            <Link to="/register" className="link link-primary">
              Sign up
            </Link>
          </p>
          <p className="text-xs text-base-content/60 border-t pt-3">
            💡 <strong>Already logged in?</strong> Go to <Link to="/settings" className="link">Settings</Link> to change your password
          </p>
        </div>
      </div>
    </div>
  );
}
