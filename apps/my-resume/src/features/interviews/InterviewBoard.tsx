import { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';
import type { Interview, InterviewStats } from './types';
import { InterviewCard } from './InterviewCard.tsx';
import { InterviewForm } from './InterviewForm.tsx';
import { InterviewStats as StatsComponent } from './InterviewStats.tsx';
import { InterviewDetail } from './InterviewDetail.tsx';

export function InterviewBoard() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [stats, setStats] = useState<InterviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [viewingInterviewId, setViewingInterviewId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadInterviews();
    loadStats();
  }, [filterStatus, filterCompany, showArchived]);

  const loadInterviews = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiClient.getInterviews({
        status: filterStatus || undefined,
        company: filterCompany || undefined,
        archived: showArchived,
      });
      setInterviews(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load interviews');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.getInterviewStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleCreateOrUpdate = async (interview: Interview) => {
    setInterviews((prev) =>
      editingInterview
        ? prev.map((i) => (i.id === interview.id ? interview : i))
        : [interview, ...prev]
    );
    setShowForm(false);
    setEditingInterview(null);
    await loadStats(); // Refresh stats
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this interview?')) return;
    try {
      await apiClient.deleteInterview(id);
      setInterviews((prev) => prev.filter((i) => i.id !== id));
      await loadStats();
    } catch (err: any) {
      alert(err.message || 'Failed to delete interview');
    }
  };

  const handleArchive = async (id: string, isArchived: boolean) => {
    try {
      if (isArchived) {
        await apiClient.unarchiveInterview(id);
      } else {
        await apiClient.archiveInterview(id);
      }
      await loadInterviews();
      await loadStats();
    } catch (err: any) {
      alert(err.message || `Failed to ${isArchived ? 'unarchive' : 'archive'} interview`);
    }
  };

  const handleEdit = (interview: Interview) => {
    setEditingInterview(interview);
    setShowForm(true);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">📋 Interview Tracker</h1>
          <p className="text-base-content/60 mt-1">
            Track your job applications and interview processes
          </p>
        </div>
        <button
          className="btn btn-primary gap-2"
          onClick={() => {
            setEditingInterview(null);
            setShowForm(true);
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          New Interview
        </button>
      </div>

      {/* Stats */}
      {stats && <StatsComponent stats={stats} />}

      {/* Filters */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="form-control flex-1 min-w-[200px]">
              <label className="label">
                <span className="label-text">Company</span>
              </label>
              <input
                type="text"
                placeholder="Search by company..."
                className="input input-bordered"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
              />
            </div>
            <div className="form-control flex-1 min-w-[200px]">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                className="select select-bordered"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="APPLIED">Applied</option>
                <option value="SCREENING">Screening</option>
                <option value="TECHNICAL">Technical</option>
                <option value="ONSITE">Onsite</option>
                <option value="FINAL_ROUND">Final Round</option>
                <option value="OFFER">Offer</option>
                <option value="NEGOTIATING">Negotiating</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer gap-2">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                <span className="label-text">Show Archived</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {/* Interview Form Modal */}
      {showForm && (
        <InterviewForm
          interview={editingInterview}
          onSave={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingInterview(null);
          }}
        />
      )}

      {/* Interviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card bg-base-100 shadow">
              <div className="card-body">
                <div className="skeleton h-6 w-3/4"></div>
                <div className="skeleton h-4 w-full"></div>
                <div className="skeleton h-4 w- 2/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : interviews.length === 0 ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body text-center py-12">
            <svg
              className="mx-auto h-24 w-24 text-base-content/20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium">No interviews yet</h3>
            <p className="mt-2 text-sm text-base-content/60">
              Start tracking your interview processes
            </p>
            <button
              className="btn btn-primary mt-6"
              onClick={() => setShowForm(true)}
            >
              Add Your First Interview
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onView={() => setViewingInterviewId(interview.id)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {viewingInterviewId && (
        <InterviewDetail
          interviewId={viewingInterviewId}
          onClose={() => setViewingInterviewId(null)}
          onUpdate={(updatedInterview) => {
            setInterviews(
              interviews.map((i) =>
                i.id === updatedInterview.id ? updatedInterview : i
              )
            );
            loadStats();
          }}
        />
      )}
    </div>
  );
}
