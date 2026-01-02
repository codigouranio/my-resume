import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { apiClient } from '../../shared/api/client';
import './SettingsPage.css';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('profile');
  const [customDomain, setCustomDomain] = useState('');
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [domainSuccess, setDomainSuccess] = useState('');

  useEffect(() => {
    if (user?.customDomain) {
      setCustomDomain(user.customDomain);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSaveCustomDomain = async () => {
    setIsSavingDomain(true);
    setDomainError('');
    setDomainSuccess('');

    try {
      await apiClient.updateCurrentUser({ customDomain: customDomain || null });
      setDomainSuccess('Custom subdomain updated successfully!');
      setIsEditingDomain(false);

      // Refresh user data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setDomainError(err.message || 'Failed to update subdomain');
    } finally {
      setIsSavingDomain(false);
    }
  };

  const isPro = user?.subscriptionTier === 'PRO';

  return (
    <div className="settings-container min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-base-300 shadow-lg">
        <div className="flex-1">
          <Link to="/dashboard" className="btn btn-ghost normal-case text-xl flex items-center gap-2">
            <img src="/logo.png" alt="RC" className="w-8 h-8" />
            <span style={{ color: '#00C2CB', fontWeight: 700 }}>Resume</span>
            <span style={{ color: '#007BFF', fontWeight: 700 }}>Cast.ai</span>
          </Link>
        </div>
        <div className="flex-none gap-2">
          <Link to="/dashboard" className="btn btn-ghost">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Settings</h1>

        {/* Tabs */}
        <div className="tabs tabs-boxed mb-6 bg-base-200">
          <a
            className={`tab tab-lg ${activeTab === 'profile' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </a>
          <a
            className={`tab tab-lg ${activeTab === 'subscription' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('subscription')}
          >
            ⭐ Subscription
          </a>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Profile Information</h2>

              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Email</span>
                  </label>
                  <input
                    type="text"
                    value={user?.email || ''}
                    disabled
                    className="input input-bordered bg-base-300"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">First Name</span>
                    </label>
                    <input
                      type="text"
                      value={user?.firstName || ''}
                      disabled
                      className="input input-bordered bg-base-300"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-semibold">Last Name</span>
                    </label>
                    <input
                      type="text"
                      value={user?.lastName || ''}
                      disabled
                      className="input input-bordered bg-base-300"
                    />
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Account Type</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${isPro ? 'badge-primary' : 'badge-ghost'} badge-lg`}>
                      {user?.subscriptionTier || 'FREE'}
                    </span>
                    {!isPro && (
                      <button

                        {/* Custom Subdomain - PRO Only */}
                        {isPro && (
                          <>
                            <div className="divider"></div>
                            <div className="form-control">
                              <label className="label">
                                <span className="label-text font-semibold">Custom Subdomain (PRO)</span>
                                <span className="label-text-alt badge badge-primary">PRO Feature</span>
                              </label>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={customDomain}
                                    onChange={(e) => setCustomDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    disabled={!isEditingDomain || isSavingDomain}
                                    placeholder="yourname"
                                    className="input input-bordered flex-1"
                                    minLength={3}
                                    maxLength={63}
                                  />
                                  <span className="text-sm text-base-content/60">.resumecast.ai</span>
                                </div>
                                <p className="text-xs text-base-content/60">
                                  • 3-63 characters • Lowercase letters, numbers, hyphens only • No hyphens at start/end
                                </p>

                                {domainError && (
                                  <div className="alert alert-error">
                                    <span>{domainError}</span>
                                  </div>
                                )}

                                {domainSuccess && (
                                  <div className="alert alert-success">
                                    <span>{domainSuccess}</span>
                                  </div>
                                )}

                                {user?.customDomain && !isEditingDomain && (
                                  <div className="alert alert-info">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Your resume is accessible at: <a href={`https://${user.customDomain}.resumecast.ai`} target="_blank" rel="noopener noreferrer" className="link">{user.customDomain}.resumecast.ai</a></span>
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  {!isEditingDomain ? (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => setIsEditingDomain(true)}
                                    >
                                      {user?.customDomain ? 'Change Subdomain' : 'Set Custom Subdomain'}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={handleSaveCustomDomain}
                                        disabled={isSavingDomain || !customDomain || customDomain.length < 3}
                                      >
                                        {isSavingDomain ? (
                                          <>
                                            <span className="loading loading-spinner loading-xs"></span>
                                            Saving...
                                          </>
                                        ) : (
                                          'Save'
                                        )}
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                          setIsEditingDomain(false);
                                          setCustomDomain(user?.customDomain || '');
                                          setDomainError('');
                                        }}
                                        disabled={isSavingDomain}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        className="btn btn-primary btn-sm"
                        onClick={() => setActiveTab('subscription')}
                      >
                        Upgrade to PRO
                      </button>
                    )}
                  </div>
                </div>

                <div className="divider"></div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-semibold">Account Actions</span>
                  </label>
                  <div className="flex gap-2">
                    <button className="btn btn-error btn-outline" onClick={handleLogout}>
                      🚪 Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl mb-4">Current Plan</h2>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-3xl font-bold mb-2">
                      {isPro ? (
                        <span className="text-primary">PRO Plan</span>
                      ) : (
                        <span>FREE Plan</span>
                      )}
                    </div>
                    <p className="text-base-content/60">
                      {isPro ? 'You have access to all premium features' : 'Upgrade to unlock premium features'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {isPro ? '$9' : '$0'}
                    </div>
                    <div className="text-sm text-base-content/60">per month</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* FREE */}
              <div className={`card bg-base-200 shadow-xl ${!isPro ? 'border-2 border-primary' : ''}`}>
                <div className="card-body">
                  <h3 className="card-title">FREE</h3>
                  <div className="text-3xl font-bold mb-4">$0<span className="text-sm font-normal">/month</span></div>

                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Create unlimited resumes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Public resume URLs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Basic view count</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>AI chat assistant</span>
                    </li>
                  </ul>

                  {!isPro && (
                    <div className="badge badge-primary">Current Plan</div>
                  )}
                </div>
              </div>

              {/* PRO */}
              <div className={`card bg-base-200 shadow-xl ${isPro ? 'border-2 border-primary' : ''}`}>
                <div className="card-body">
                  <h3 className="card-title text-primary">PRO ⭐</h3>
                  <div className="text-3xl font-bold mb-4">$9<span className="text-sm font-normal">/month</span></div>

                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span className="font-semibold">Everything in FREE, plus:</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Detailed analytics dashboard</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Unique visitors tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Top referrers & countries</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-success">✓</span>
                      <span>Custom subdomain</span>
                    </li>
                  </ul>

                  {isPro ? (
                    <div className="badge badge-primary">Current Plan</div>
                  ) : (
                    <Link to="/pricing" className="btn btn-primary">
                      Upgrade Now
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Manage Subscription (if PRO) */}
            {isPro && (
              <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">Manage Subscription</h3>
                  <p className="text-base-content/60 mb-4">
                    Update payment method, view invoices, or cancel your subscription
                  </p>
                  <div>
                    <a href="/api/subscriptions/portal" className="btn btn-outline">
                      Manage Billing
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
