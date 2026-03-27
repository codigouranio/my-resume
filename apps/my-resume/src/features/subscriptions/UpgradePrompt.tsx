import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { getDisplayBaseDomain } from '../../shared/utils/domain';
import { formatUsdPrice } from '../../shared/utils/pricing';
import './UpgradePrompt.css';

interface UpgradePromptProps {
  onClose?: () => void;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [priceAmount, setPriceAmount] = useState<number | null>(null);
  const [priceInterval, setPriceInterval] = useState('month');
  const [priceId, setPriceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPrice = async () => {
      try {
        const data = await apiClient.getPriceDetails('SUBSCRIPTION_PRO');
        if (!isMounted) {
          return;
        }

        if (typeof data?.unitAmount === 'number') {
          setPriceAmount(data.unitAmount / 100);
        }

        if (data?.interval) {
          setPriceInterval(data.interval);
        }

        setPriceId(data?.id ?? null);
      } catch (err) {
        console.error('Failed to load Stripe price', err);
      }
    };

    loadPrice();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError('');

    try {
      const checkoutPriceId =
        priceId || import.meta.env.PUBLIC_STRIPE_PRICE_ID || 'price_1234567890';

      const response = await apiClient.createCheckoutSession(checkoutPriceId);

      if (response.url) {
        // Redirect to Stripe checkout
        window.location.href = response.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="upgrade-prompt">
      <div className="upgrade-content">
        <div className="upgrade-icon">⭐</div>
        <h3 className="upgrade-title">Upgrade to PRO</h3>
        <p className="upgrade-description">
          Unlock detailed analytics, custom subdomain, and more features with {getDisplayBaseDomain().replace(/^\w+-/, '').split('.')[0].toUpperCase()} PRO.
        </p>

        <div className="upgrade-features">
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>Detailed Analytics Dashboard</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🌐</span>
            <span>Custom Subdomain (yourname.{getDisplayBaseDomain()})</span>
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
          <span className="price">{formatUsdPrice(priceAmount ?? 9)}</span>
          <span className="period">/{priceInterval}</span>
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
          <button
            className="btn btn-outline"
            onClick={() => {
              if (onClose) onClose();
              navigate('/pricing');
            }}
          >
            View Plans
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
