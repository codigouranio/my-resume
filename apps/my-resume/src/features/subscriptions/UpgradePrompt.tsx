import React, { useState } from 'react';
import { apiClient } from '../../shared/utils/apiClient';
import './UpgradePrompt.css';

interface UpgradePromptProps {
  onClose?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError('');

    try {
      const priceId = import.meta.env.PUBLIC_STRIPE_PRICE_ID || 'price_1234567890'; // Replace with actual Stripe price ID

      const response = await apiClient.post('/subscriptions/checkout', { priceId });

      if (response.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.message || 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="upgrade-prompt">
      <div className="upgrade-content">
        <div className="upgrade-icon">⭐</div>
        <h3 className="upgrade-title">Upgrade to PRO</h3>
        <p className="upgrade-description">
          Unlock detailed analytics, custom subdomain, and more features with ResumeCast.ai PRO.
        </p>

        <div className="upgrade-features">
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>Detailed Analytics Dashboard</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🌐</span>
            <span>Custom Subdomain (yourname.resumecast.ai)</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📈</span>
            <span>Top Referrers & Countries</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⏱️</span>
            <span>Average Session Duration</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">👥</span>
            <span>Unique Visitors Tracking</span>
          </div>
        </div>

        <div className="upgrade-pricing">
          <span className="price">$9</span>
          <span className="period">/month</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="upgrade-actions">
          <button
            className="btn btn-primary btn-lg"
            onClick={handleUpgrade}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Processing...
              </>
            ) : (
              'Upgrade Now'
            )}
          </button>
          {onClose && (
            <button className="btn btn-ghost" onClick={onClose}>
              Maybe Later
            </button>
          )}
        </div>

        <p className="upgrade-note">
          Cancel anytime. No questions asked.
        </p>
      </div>
    </div>
  );
};
