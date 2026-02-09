import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';

interface AnalyticsData {
  totalViews: number;
  uniqueVisitors: number;
  avgDuration: number;
  topReferrers: Array<{ source: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  recentViews: Array<{
    id: string;
    viewedAt: string;
    country?: string;
    city?: string;
    referrer?: string;
  }>;
}

interface AnalyticsDashboardProps {
  resumeId: string;
}

export function AnalyticsDashboard({ resumeId }: AnalyticsDashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const isPro = user?.subscriptionTier === 'PRO';

  useEffect(() => {
    loadAnalytics();
  }, [resumeId]);

  const loadAnalytics = async () => {
    try {
      if (isPro) {
        // PRO users: load detailed analytics
        const response = await fetch(`/api/resumes/${resumeId}/analytics/detailed`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        } else {
          // If detailed analytics fails, still show basic stats
          const basicResponse = await fetch(`/api/resumes/${resumeId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          const resumeData = await basicResponse.json();
          setAnalytics({
            totalViews: resumeData.viewCount || 0,
            uniqueVisitors: 0,
            avgDuration: 0,
            topReferrers: [],
            topCountries: [],
            recentViews: [],
          });
        }
      } else {
        // Free tier: only show basic view count
        const basicResponse = await fetch(`/api/resumes/${resumeId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const resumeData = await basicResponse.json();
        setAnalytics({
          totalViews: resumeData.viewCount || 0,
          uniqueVisitors: 0,
          avgDuration: 0,
          topReferrers: [],
          topCountries: [],
          recentViews: [],
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Set default empty analytics on error to avoid showing error message
      setAnalytics({
        totalViews: 0,
        uniqueVisitors: 0,
        avgDuration: 0,
        topReferrers: [],
        topCountries: [],
        recentViews: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!analytics) {
    return <div className="alert alert-error">Failed to load analytics</div>;
  }

  return (
    <div className="analytics-dashboard space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-figure text-primary">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div className="stat-title">Total Views</div>
          <div className="stat-value text-primary">{analytics.totalViews}</div>
        </div>

        {isPro && (
          <>
            <div className="stat bg-base-200 rounded-box">
              <div className="stat-figure text-secondary">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="stat-title">Unique Visitors</div>
              <div className="stat-value text-secondary">{analytics.uniqueVisitors}</div>
            </div>

            <div className="stat bg-base-200 rounded-box">
              <div className="stat-figure text-accent">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-title">Avg. Time Spent</div>
              <div className="stat-value text-accent">{analytics.avgDuration}s</div>
            </div>
          </>
        )}
      </div>

      {isPro && (
        <>
          {/* Top Referrers */}
          {analytics.topReferrers.length > 0 && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">Top Referral Sources</h3>
                <div className="space-y-2">
                  {analytics.topReferrers.map((referrer, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{referrer.source || 'Direct'}</span>
                      <span className="badge badge-primary">{referrer.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Top Countries */}
          {analytics.topCountries.length > 0 && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">Visitor Locations</h3>
                <div className="space-y-2">
                  {analytics.topCountries.map((location, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm">{location.country}</span>
                      <span className="badge badge-secondary">{location.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Views */}
          {analytics.recentViews.length > 0 && (
            <div className="card bg-base-200">
              <div className="card-body">
                <h3 className="card-title text-lg">Recent Views</h3>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Location</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.recentViews.map((view) => (
                        <tr key={view.id}>
                          <td>{new Date(view.viewedAt).toLocaleString()}</td>
                          <td>{view.city ? `${view.city}, ${view.country}` : view.country || 'Unknown'}</td>
                          <td className="text-xs truncate max-w-xs">{view.referrer || 'Direct'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!isPro && (
        <div className="alert alert-info">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-bold">Upgrade to PRO for Advanced Analytics</h3>
            <p className="text-sm">Get detailed insights: visitor tracking, referral sources, geographic data, and more!</p>
          </div>
          <button onClick={() => navigate('/pricing')} className="btn btn-primary btn-sm">
            View Plans
          </button>
        </div>
      )}
    </div>
  );
}
