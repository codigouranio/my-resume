import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { apiClient } from '../../shared/api/client';
import { AnalyticsDashboard, ChatAnalyticsDashboard } from '../analytics';
import './Dashboard.css';

interface Resume {
  id: string;
  slug: string;
  title: string;
  isPublic: boolean;
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface RecruiterInterest {
  id: string;
  name: string;
  email: string;
  company?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  resume: {
    id: string;
    slug: string;
    title: string;
  };
}

export function DashboardPage() {
  const { user, logout, refreshUser } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [recruiterInterests, setRecruiterInterests] = useState<RecruiterInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInterests, setIsLoadingInterests] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'resumes' | 'interests'>('resumes');
  const [selectedResumeForAnalytics, setSelectedResumeForAnalytics] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<'views' | 'chat'>('views');
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if returning from Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    if (sessionId) {
      // User just completed checkout, refresh their data
      refreshUser().then(() => {
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      });
    }

    fetchResumes();
    fetchRecruiterInterests();
  }, []);

  const fetchResumes = async () => {
    try {
      const data = await apiClient.getMyResumes();
      setResumes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load resumes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecruiterInterests = async () => {
    try {
      const data = await apiClient.getRecruiterInterests();
      setRecruiterInterests(data);
    } catch (err: any) {
      console.error('Failed to load recruiter interests:', err);
    } finally {
      setIsLoadingInterests(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient.markInterestAsRead(id);
      setRecruiterInterests(prev =>
        prev.map(interest =>
          interest.id === id ? { ...interest, isRead: true } : interest
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to mark as read');
    }
  };

  const handleDeleteInterest = async (id: string, name: string) => {
    if (!confirm(`Delete recruiter interest from ${name}?`)) return;

    try {
      await apiClient.deleteRecruiterInterest(id);
      setRecruiterInterests(prev => prev.filter(interest => interest.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete interest');
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const updated = await apiClient.toggleFavoriteInterest(id);
      setRecruiterInterests(prev =>
        prev.map(interest =>
          interest.id === id ? { ...interest, isFavorite: updated.isFavorite } : interest
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle favorite');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;

    try {
      await apiClient.deleteResume(id);
      setResumes(resumes.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete resume');
    }
  };

  const handleViewAnalytics = async (resumeId: string) => {
    setSelectedResumeForAnalytics(resumeId);
    setIsLoadingAnalytics(true);
    try {
      const data = await apiClient.getResumeAnalytics(resumeId);
      setAnalytics(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load analytics');
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="navbar bg-base-300 shadow-lg">
        <div className="flex-1">
          <Link to="/dashboard" className="btn btn-ghost normal-case text-xl flex items-center gap-2">
            <img src="/logo.png" alt="RC" className="w-8 h-8" />
            <span style={{ color: '#00C2CB', fontWeight: 700 }}>ResumeCast</span>
            <span style={{ color: '#007BFF', fontWeight: 700 }}>.ai</span>
          </Link>
        </div>
        <div className="flex-none gap-2">
          {user?.subscriptionTier === 'PRO' ? (
            <div className="badge badge-primary badge-lg gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              PRO Member
            </div>
          ) : (
            <Link to="/settings" className="btn btn-primary btn-sm">
              ⭐ Upgrade to PRO
            </Link>
          )}
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder">
              <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
                <span className="text-xl">
                  {user?.firstName?.[0] || ''}{user?.lastName?.[0] || user?.email[0].toUpperCase()}
                </span>
              </div>
            </label>
            <ul tabIndex={0} className="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-52">
              <li className="menu-title">
                <span>{user?.email}</span>
              </li>
              <li><Link to="/settings">⚙️ Settings</Link></li>
              <li><a onClick={handleLogout}>🚪 Logout</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Tabs */}
        <div className="tabs tabs-boxed mb-6 bg-base-200">
          <a
            className={`tab tab-lg ${activeTab === 'resumes' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('resumes')}
          >
            📄 My Resumes
            <span className="badge badge-sm ml-2">{resumes.length}</span>
          </a>
          <a
            className={`tab tab-lg ${activeTab === 'interests' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('interests')}
          >
            💼 Recruiter Interests
            {recruiterInterests.filter(i => !i.isRead).length > 0 && (
              <span className="badge badge-error badge-sm ml-2">
                {recruiterInterests.filter(i => !i.isRead).length}
              </span>
            )}
          </a>
        </div>

        {activeTab === 'resumes' ? (
          <>
            <div className="dashboard-header">
              <div>
                <h1 className="text-4xl font-bold">My Resumes</h1>
                <p className="text-base-content/60 mt-2">Manage and share your professional resumes</p>
              </div>
              <button
                className="btn btn-primary gap-2"
                onClick={() => navigate('/editor/new')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Resume
              </button>
            </div>

            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                      <div className="skeleton h-6 w-3/4"></div>
                      <div className="skeleton h-4 w-full"></div>
                      <div className="skeleton h-4 w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : resumes.length === 0 ? (
              <div className="empty-state">
                <div className="text-center">
                  <svg className="mx-auto h-24 w-24 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium">No resumes yet</h3>
                  <p className="mt-2 text-sm text-base-content/60">Get started by creating your first resume</p>
                  <button
                    className="btn btn-primary mt-6"
                    onClick={() => navigate('/editor/new')}
                  >
                    Create Your First Resume
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resumes.map(resume => (
                  <div key={resume.id} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                    <div className="card-body">
                      <h2 className="card-title">{resume.title}</h2>
                      <p className="text-sm text-base-content/60">
                        {user?.customDomain ? (
                          <>
                            {user.customDomain}.resumecast.ai/{resume.slug}
                          </>
                        ) : (
                          <>/resume/{resume.slug}</>
                        )}
                      </p>

                      <div className="flex gap-2 mt-2">
                        {resume.isPublished ? (
                          <div className="badge badge-success gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Published
                          </div>
                        ) : (
                          <div className="badge badge-warning">Draft</div>
                        )}
                        {resume.isPublic && <div className="badge badge-info">Public</div>}
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-sm text-base-content/60">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        {resume.viewCount} views
                      </div>

                      <div className="card-actions justify-end mt-4">
                        {resume.isPublic && resume.isPublished && (
                          <a
                            href={user?.customDomain ? `https://${user.customDomain}.resumecast.ai/${resume.slug}` : `/resume/${resume.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-ghost gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                            </svg>
                            View
                          </a>
                        )}
                        <button
                          className="btn btn-sm btn-info gap-1"
                          onClick={() => handleViewAnalytics(resume.id)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                          </svg>
                          Analytics
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/editor/${resume.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-error btn-outline"
                          onClick={() => handleDelete(resume.id, resume.title)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="dashboard-header">
              <div>
                <h1 className="text-4xl font-bold">Recruiter Interests</h1>
                <p className="text-base-content/60 mt-2">See who's interested in your resume</p>
              </div>
            </div>

            {isLoadingInterests ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                      <div className="skeleton h-6 w-3/4"></div>
                      <div className="skeleton h-4 w-full"></div>
                      <div className="skeleton h-4 w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recruiterInterests.length === 0 ? (
              <div className="empty-state">
                <div className="text-center">
                  <svg className="mx-auto h-24 w-24 text-base-content/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium">No recruiter interests yet</h3>
                  <p className="mt-2 text-sm text-base-content/60">
                    When recruiters express interest in your resume, they'll appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recruiterInterests.map(interest => (
                  <div
                    key={interest.id}
                    className={`card bg-base-100 shadow-xl ${!interest.isRead ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="card-body">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="card-title">{interest.name}</h2>
                            {!interest.isRead && (
                              <div className="badge badge-primary">New</div>
                            )}
                          </div>
                          <p className="text-sm text-base-content/60 mt-1">
                            <a href={`mailto:${interest.email}`} className="link link-hover">
                              {interest.email}
                            </a>
                            {interest.company && ` • ${interest.company}`}
                          </p>
                          <div className="badge badge-ghost badge-sm mt-2">
                            Resume: {interest.resume.title}
                          </div>
                        </div>
                        <div className="text-sm text-base-content/60">
                          {new Date(interest.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="mt-3 p-4 bg-base-200 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{interest.message}</p>
                      </div>

                      <div className="card-actions justify-end mt-3">
                        <a
                          href={`mailto:${interest.email}?subject=Re: Your interest in my resume&body=Hi ${interest.name},%0D%0A%0D%0AThank you for your interest!%0D%0A%0D%0A`}
                          className="btn btn-sm btn-primary gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          Reply
                        </a>
                        <button
                          className={`btn btn-sm gap-1 ${interest.isFavorite ? 'btn-warning' : 'btn-ghost'}`}
                          onClick={() => handleToggleFavorite(interest.id)}
                          title={interest.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill={interest.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {interest.isFavorite ? 'Favorited' : 'Favorite'}
                        </button>
                        {!interest.isRead && (
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleMarkAsRead(interest.id)}
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-error btn-outline gap-1 outline-blue-500"
                          onClick={() => handleDeleteInterest(interest.id, interest.name)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Analytics Modal */}
      {selectedResumeForAnalytics && (
        <div className="modal modal-open">
          <div className="modal-box max-w-6xl max-h-[90vh] overflow-y-auto">
            {/* Close button - top right */}
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => {
                setSelectedResumeForAnalytics(null);
                setAnalytics(null);
                setAnalyticsView('views');
              }}
            >
              ✕
            </button>

            <h3 className="font-bold text-2xl mb-4">
              Analytics: {resumes.find(r => r.id === selectedResumeForAnalytics)?.title}
            </h3>

            {/* Analytics Tabs */}
            <div className="tabs tabs-boxed mb-6">
              <a
                className={`tab tab-lg ${analyticsView === 'views' ? 'tab-active' : ''}`}
                onClick={() => setAnalyticsView('views')}
              >
                👁️ Page Views
              </a>
              <a
                className={`tab tab-lg ${analyticsView === 'chat' ? 'tab-active' : ''}`}
                onClick={() => setAnalyticsView('chat')}
              >
                💬 Chat Analytics
              </a>
            </div>

            {/* Analytics Content */}
            {analyticsView === 'views' ? (
              <AnalyticsDashboard resumeId={selectedResumeForAnalytics} />
            ) : (
              <ChatAnalyticsDashboard resumeId={selectedResumeForAnalytics} />
            )}

            <div className="modal-action mt-6">
              <button
                className="btn"
                onClick={() => {
                  setSelectedResumeForAnalytics(null);
                  setAnalytics(null);
                  setAnalyticsView('views');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
