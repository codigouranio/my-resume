import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { apiClient } from '../../shared/api/client';
import { formatUsdPrice } from '../../shared/utils/pricing';

interface AdminOverview {
  counts: {
    totalUsers: number;
    adminUsers: number;
    proUsers: number;
    enterpriseUsers: number;
    totalResumes: number;
    publishedResumes: number;
    customDomainUsers: number;
  };
  queue: {
    stats: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      total: number;
    } | null;
    error: string | null;
    dashboardPath: string;
  };
  pricing: {
    configuredPriceId: string | null;
    details: {
      id: string;
      unitAmount: number | null;
      interval: string | null;
      productName: string | null;
      currency: string;
    } | null;
    error: string | null;
  };
  services: {
    llmServiceUrl: string | null;
    nodeEnv: string | null;
  };
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  subscriptionTier: string;
  customDomain: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    resumes: number;
  };
}

const API_BASE_URL = import.meta.env.PUBLIC_API_URL || '/api';

function formatDisplayName(user: AdminUser) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || 'No profile name';
}

export function BackofficePage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('ALL');
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [operationLoading, setOperationLoading] = useState<Record<string, boolean>>({});
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const queueDashboardUrl = `${API_BASE_URL.replace(/\/?api\/?$/, '')}${overview?.queue.dashboardPath ?? '/api/admin/queues'}`;

  const loadOverview = async () => {
    try {
      setOverviewError('');
      const data = await apiClient.getAdminOverview();
      setOverview(data);
    } catch (error: any) {
      setOverviewError(error.message || 'Failed to load admin overview');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const loadUsers = async (currentSearch: string, currentTier: string) => {
    try {
      setUsersError('');
      const data = await apiClient.getAdminUsers({
        search: currentSearch || undefined,
        subscriptionTier: currentTier === 'ALL' ? undefined : currentTier,
      });
      setUsers(data);
    } catch (error: any) {
      setUsersError(error.message || 'Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsLoadingUsers(true);
      loadUsers(search, subscriptionTier);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search, subscriptionTier]);

  const setActionLoading = (action: string, loading: boolean) => {
    setOperationLoading((previous) => ({ ...previous, [action]: loading }));
  };

  const runOperation = async (
    action: string,
    operation: () => Promise<any>,
    successMessage: (result: any) => string,
    confirmMessage?: string,
  ) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    setOperationMessage(null);
    setActionLoading(action, true);

    try {
      const result = await operation();
      setOperationMessage({ type: 'success', text: successMessage(result) });
      await loadOverview();
      await loadUsers(search, subscriptionTier);
    } catch (error: any) {
      setOperationMessage({
        type: 'error',
        text: error.message || 'Operation failed',
      });
    } finally {
      setActionLoading(action, false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="badge badge-outline badge-lg mb-3">Internal Admin</div>
            <h1 className="text-4xl font-bold">Back Office</h1>
            <p className="text-base-content/70 mt-2 max-w-3xl">
              Operational visibility for subscriptions, queue health, and account access.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className="btn btn-ghost">
              Return to dashboard
            </Link>
            <button className="btn btn-primary" onClick={() => loadOverview()}>
              Refresh overview
            </button>
          </div>
        </div>

        <div className="alert alert-info">
          <span>
            Signed in as {user?.email}. Maintenance operations (relink, normalize, queue cleanup) are available in the Operations card below.
          </span>
        </div>

        {overviewError ? (
          <div className="alert alert-error">
            <span>{overviewError}</span>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <p className="text-sm uppercase tracking-wide text-base-content/60">Users</p>
              <p className="text-4xl font-bold">
                {isLoadingOverview ? <span className="loading loading-spinner loading-md"></span> : overview?.counts.totalUsers ?? '—'}
              </p>
              <p className="text-sm text-base-content/70">
                {overview?.counts.proUsers ?? 0} PRO, {overview?.counts.enterpriseUsers ?? 0} enterprise
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <p className="text-sm uppercase tracking-wide text-base-content/60">Resumes</p>
              <p className="text-4xl font-bold">
                {isLoadingOverview ? <span className="loading loading-spinner loading-md"></span> : overview?.counts.totalResumes ?? '—'}
              </p>
              <p className="text-sm text-base-content/70">
                {overview?.counts.publishedResumes ?? 0} published, {overview?.counts.customDomainUsers ?? 0} custom domains
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <p className="text-sm uppercase tracking-wide text-base-content/60">Queue</p>
              <p className="text-4xl font-bold">
                {isLoadingOverview ? <span className="loading loading-spinner loading-md"></span> : overview?.queue.stats?.total ?? '—'}
              </p>
              <p className="text-sm text-base-content/70">
                {overview?.queue.error ? overview.queue.error : `${overview?.queue.stats?.failed ?? 0} failed, ${overview?.queue.stats?.active ?? 0} active`}
              </p>
            </div>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <p className="text-sm uppercase tracking-wide text-base-content/60">Stripe PRO</p>
              <p className="text-4xl font-bold">
                {isLoadingOverview ? (
                  <span className="loading loading-spinner loading-md"></span>
                ) : overview?.pricing.details?.unitAmount ? (
                  formatUsdPrice(overview.pricing.details.unitAmount / 100)
                ) : (
                  '—'
                )}
              </p>
              <p className="text-sm text-base-content/70">
                {overview?.pricing.error
                  ? overview.pricing.error
                  : overview?.pricing.details?.interval
                    ? `per ${overview.pricing.details.interval}`
                    : overview?.pricing.configuredPriceId || 'No price configured'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="card-title text-2xl">Accounts</h2>
                  <p className="text-base-content/70">Search by email, name, or custom domain.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className="input input-bordered"
                    placeholder="Search users"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    className="select select-bordered"
                    value={subscriptionTier}
                    onChange={(event) => setSubscriptionTier(event.target.value)}
                  >
                    <option value="ALL">All plans</option>
                    <option value="FREE">FREE</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
              </div>

              {usersError ? (
                <div className="alert alert-error mt-4">
                  <span>{usersError}</span>
                </div>
              ) : null}

              <div className="overflow-x-auto mt-4">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Plan</th>
                      <th>Resumes</th>
                      <th>Domain</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8">
                          <span className="loading loading-spinner loading-lg"></span>
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-base-content/60">
                          No users matched the current filters.
                        </td>
                      </tr>
                    ) : (
                      users.map((account) => (
                        <tr key={account.id}>
                          <td>
                            <div className="font-semibold">{formatDisplayName(account)}</div>
                            <div className="text-sm text-base-content/60">{account.email}</div>
                          </td>
                          <td>
                            <span className={`badge ${account.role === 'ADMIN' ? 'badge-secondary' : 'badge-ghost'}`}>
                              {account.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${account.subscriptionTier === 'PRO' ? 'badge-primary' : account.subscriptionTier === 'ENTERPRISE' ? 'badge-accent' : 'badge-ghost'}`}>
                              {account.subscriptionTier}
                            </span>
                          </td>
                          <td>{account._count.resumes}</td>
                          <td>{account.customDomain || '—'}</td>
                          <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl">Operational Links</h2>
                <div className="space-y-3">
                  <a className="btn btn-outline btn-block justify-start" href={queueDashboardUrl} target="_blank" rel="noreferrer">
                    Open Bull queue dashboard
                  </a>
                  <Link className="btn btn-outline btn-block justify-start" to="/settings">
                    Open subscription settings
                  </Link>
                  <Link className="btn btn-outline btn-block justify-start" to="/pricing">
                    View public pricing page
                  </Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl">Operations</h2>
                <p className="text-sm text-base-content/70">
                  Admin maintenance actions for searchability and queue hygiene.
                </p>

                {operationMessage ? (
                  <div className={`alert ${operationMessage.type === 'success' ? 'alert-success' : 'alert-error'} mt-2`}>
                    <span>{operationMessage.text}</span>
                  </div>
                ) : null}

                <div className="space-y-3 mt-2">
                  <button
                    className="btn btn-primary btn-block justify-start"
                    disabled={!!operationLoading.relink}
                    onClick={() =>
                      runOperation(
                        'relink',
                        () => apiClient.relinkAllInterviews(),
                        (result) =>
                          `Re-linked ${result.interviewsLinked ?? 0} interviews across ${result.companiesProcessed ?? 0} companies. Normalized ${result.interviewsNormalized ?? 0} interview names.`,
                        'Run global relink + normalization now? This can take a while.',
                      )
                    }
                  >
                    {operationLoading.relink ? <span className="loading loading-spinner loading-sm"></span> : '♻️'}
                    Re-link all data for search
                  </button>

                  <button
                    className="btn btn-outline btn-block justify-start"
                    disabled={!!operationLoading.normalize}
                    onClick={() =>
                      runOperation(
                        'normalize',
                        () => apiClient.normalizeCompanyNames(),
                        (result) =>
                          `Normalized ${result.interviewsUpdated ?? 0} interview company names across ${(result.companies || []).length} companies.`,
                        'Normalize all interview company names now?',
                      )
                    }
                  >
                    {operationLoading.normalize ? <span className="loading loading-spinner loading-sm"></span> : '🧹'}
                    Normalize company names
                  </button>

                  <button
                    className="btn btn-outline btn-block justify-start"
                    disabled={!!operationLoading.clearFailed}
                    onClick={() =>
                      runOperation(
                        'clearFailed',
                        () => apiClient.clearFailedEmbeddingJobs(),
                        () => 'Cleared failed embedding jobs.',
                        'Clear failed embedding jobs from the queue?',
                      )
                    }
                  >
                    {operationLoading.clearFailed ? <span className="loading loading-spinner loading-sm"></span> : '🗑️'}
                    Clear failed embedding jobs
                  </button>

                  <button
                    className="btn btn-warning btn-block justify-start"
                    disabled={!!operationLoading.fullMaintenance}
                    onClick={() =>
                      runOperation(
                        'fullMaintenance',
                        async () => {
                          const relink = await apiClient.relinkAllInterviews();
                          const normalize = await apiClient.normalizeCompanyNames();
                          await apiClient.clearFailedEmbeddingJobs();
                          return { relink, normalize };
                        },
                        (result) =>
                          `Full maintenance done — re-linked ${result.relink?.interviewsLinked ?? 0} interviews, normalized ${result.normalize?.interviewsUpdated ?? 0} company names, cleared failed jobs.`,
                        'Run full maintenance (relink + normalize + clear failed jobs)? This can take a while.',
                      )
                    }
                  >
                    {operationLoading.fullMaintenance ? <span className="loading loading-spinner loading-sm"></span> : '🚀'}
                    Run full maintenance
                  </button>

                  <button
                    className="btn btn-ghost btn-block justify-start"
                    disabled={!!operationLoading.refresh}
                    onClick={() =>
                      runOperation(
                        'refresh',
                        async () => {
                          await loadOverview();
                          await loadUsers(search, subscriptionTier);
                          return {};
                        },
                        () => 'Backoffice data refreshed.',
                      )
                    }
                  >
                    {operationLoading.refresh ? <span className="loading loading-spinner loading-sm"></span> : '🔄'}
                    Refresh operational data
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-2xl">Runtime</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold">Environment</p>
                    <p className="text-base-content/70">{overview?.services.nodeEnv || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">LLM service</p>
                    <p className="text-base-content/70 break-all">{overview?.services.llmServiceUrl || 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Queue breakdown</p>
                    <p className="text-base-content/70">
                      Waiting {overview?.queue.stats?.waiting ?? 0}, active {overview?.queue.stats?.active ?? 0}, delayed {overview?.queue.stats?.delayed ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}