import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../shared/api/client';
import type { Interview, TimelineEntry, Reminder } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';

interface InterviewDetailProps {
  interviewId: string;
  onClose: () => void;
  onUpdate: (interview: Interview) => void;
}

export function InterviewDetail({ interviewId, onClose, onUpdate }: InterviewDetailProps) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderDate, setNewReminderDate] = useState('');
  const [isAddingReminder, setIsAddingReminder] = useState(false);

  useEffect(() => {
    loadInterview();
  }, [interviewId]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const loadInterview = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.getInterview(interviewId);
      setInterview(data);
      setTimeline(data.timeline || []);

      // Load reminders
      await loadReminders();
    } catch (error) {
      console.error('Failed to load interview:', error);
      alert('Failed to load interview details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadReminders = async () => {
    try {
      const data = await apiClient.getInterviewReminders(interviewId);
      setReminders(data);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    }
  };

  const handleAddTimelineEntry = async () => {
    if (!newComment.trim()) return;

    setIsAddingEntry(true);
    try {
      await apiClient.addInterviewTimelineEntry(interviewId, {
        comment: newComment,
        attachmentFile: selectedFile || undefined,
      });

      // Reload interview to get updated timeline
      await loadInterview();

      setNewComment('');
      setSelectedFile(null);

      // Notify parent of update
      if (interview) {
        onUpdate(interview);
      }
    } catch (error) {
      console.error('Failed to add timeline entry:', error);
      alert('Failed to add timeline entry');
    } finally {
      setIsAddingEntry(false);
    }
  };

  const handleAddReminder = async () => {
    if (!newReminderTitle.trim() || !newReminderDate) return;

    setIsAddingReminder(true);
    try {
      await apiClient.createInterviewReminder(interviewId, newReminderTitle, newReminderDate);
      await loadReminders();
      setNewReminderTitle('');
      setNewReminderDate('');
    } catch (error) {
      console.error('Failed to add reminder:', error);
      alert('Failed to add reminder');
    } finally {
      setIsAddingReminder(false);
    }
  };

  const handleToggleReminder = async (reminderId: string, completed: boolean) => {
    try {
      await apiClient.completeInterviewReminder(reminderId, completed);
      await loadReminders();
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
      alert('Failed to update reminder');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Delete this reminder?')) return;

    try {
      await apiClient.deleteInterviewReminder(reminderId);
      await loadReminders();
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      alert('Failed to delete reminder');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  if (isLoading) {
    return (
      <div className="modal modal-open">
        <div className="modal-box max-w-4xl">
          <div className="flex justify-center items-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <p>Interview not found</p>
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="modal modal-open" style={{ zIndex: 9999 }}>
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold">{interview.position}</h3>
            <p className="text-lg text-base-content/70">{interview.company}</p>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className={`badge ${STATUS_COLORS[interview.status]}`}>
                {STATUS_LABELS[interview.status]}
              </span>
              {/* Fit Score Badge */}
              {interview.fitScore !== undefined && interview.fitScore !== null && (
                <span
                  className={`badge badge-lg font-bold ${interview.fitScore >= 8
                      ? 'badge-success'
                      : interview.fitScore >= 6
                        ? 'badge-warning'
                        : 'badge-error'
                    }`}
                  title="AI Position Fit Score"
                >
                  🎯 {interview.fitScore.toFixed(1)}/10
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Interview Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {interview.jobUrl && (
            <div>
              <label className="label">
                <span className="label-text font-semibold">Job Posting</span>
              </label>
              <a
                href={interview.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-primary text-sm break-all"
              >
                {interview.jobUrl}
              </a>
            </div>
          )}

          <div>
            <label className="label">
              <span className="label-text font-semibold">Applied Date</span>
            </label>
            <p className="text-sm">
              {new Date(interview.appliedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {interview.skillTags && interview.skillTags.length > 0 && (
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Skills</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {interview.skillTags.map((skill, index) => (
                  <div key={index} className="badge badge-outline">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
          )}

          {interview.description && (
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Description</span>
              </label>
              <p className="text-sm whitespace-pre-wrap">{interview.description}</p>
            </div>
          )}

          {(interview.recruiterName || interview.recruiterEmail || interview.recruiterPhone) && (
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Recruiter Contact</span>
              </label>
              <div className="space-y-1 text-sm">
                {interview.recruiterName && <p>👤 {interview.recruiterName}</p>}
                {interview.recruiterEmail && (
                  <p>
                    📧{' '}
                    <a href={`mailto:${interview.recruiterEmail}`} className="link">
                      {interview.recruiterEmail}
                    </a>
                  </p>
                )}
                {interview.recruiterPhone && <p>📞 {interview.recruiterPhone}</p>}
              </div>
            </div>
          )}

          {interview.resume && (
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text font-semibold">Resume Used</span>
              </label>
              <p className="text-sm">{interview.resume.title}</p>
            </div>
          )}
        </div>

        {/* AI Fit Analysis */}
        {interview.fitScore !== undefined && interview.fitAnalysis && (() => {
          try {
            const analysis = JSON.parse(interview.fitAnalysis);
            return (
              <div className="mb-6 p-4 bg-base-200 rounded-lg">
                <h4 className="text-lg font-bold mb-3">🎯 AI Position Fit Analysis</h4>

                {analysis.summary && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-1">Summary:</p>
                    <p className="text-sm text-base-content/80">{analysis.summary}</p>
                  </div>
                )}

                {analysis.strengths && analysis.strengths.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2 text-success">✅ Strengths:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.strengths.map((strength: string, idx: number) => (
                        <li key={idx} className="text-sm text-base-content/80">{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.gaps && analysis.gaps.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-semibold mb-2 text-warning">⚠️ Gaps:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.gaps.map((gap: string, idx: number) => (
                        <li key={idx} className="text-sm text-base-content/80">{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-info">💡 Recommendations:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {analysis.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm text-base-content/80">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          } catch (e) {
            return null; // Invalid JSON, skip rendering
          }
        })()}

        {/* Company Information Section */}
        {interview.companyInfo && (
          <>
            <div className="divider">Company Information</div>
            <div className="bg-base-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-4 mb-4">
                {interview.companyInfo.logoUrl && (
                  <img
                    src={interview.companyInfo.logoUrl}
                    alt={`${interview.company} logo`}
                    className="w-20 h-20 rounded object-contain bg-white border border-base-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xl font-bold">{interview.company}</h4>
                    {interview.companyInfo.website && (
                      <a
                        href={interview.companyInfo.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-ghost"
                        title="Company Website"
                      >
                        🌐
                      </a>
                    )}
                    {interview.companyInfo.linkedinUrl && (
                      <a
                        href={interview.companyInfo.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-ghost"
                        title="LinkedIn"
                      >
                        🔗
                      </a>
                    )}
                    {interview.companyInfo.twitterHandle && (
                      <a
                        href={`https://twitter.com/${interview.companyInfo.twitterHandle.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-ghost"
                        title="Twitter"
                      >
                        🐦
                      </a>
                    )}
                    {interview.companyInfo.githubUrl && (
                      <a
                        href={interview.companyInfo.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-ghost"
                        title="GitHub"
                      >
                        💻
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {interview.companyInfo.industry && (
                      <span className="badge badge-primary">{interview.companyInfo.industry}</span>
                    )}
                    {interview.companyInfo.companySize && (
                      <span className="badge badge-secondary">{interview.companyInfo.companySize}</span>
                    )}
                    {interview.companyInfo.glassdoorRating && (
                      <span className="badge">⭐ {interview.companyInfo.glassdoorRating}</span>
                    )}
                  </div>
                </div>
              </div>

              {interview.companyInfo.description && (
                <p className="text-sm mb-4">{interview.companyInfo.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interview.companyInfo.founded && (
                  <div>
                    <span className="text-sm font-semibold">Founded</span>
                    <p className="text-sm">{interview.companyInfo.founded}</p>
                  </div>
                )}

                {interview.companyInfo.headquarters && (
                  <div>
                    <span className="text-sm font-semibold">Headquarters</span>
                    <p className="text-sm">{interview.companyInfo.headquarters}</p>
                  </div>
                )}

                {interview.companyInfo.employeeCount && (
                  <div>
                    <span className="text-sm font-semibold">Employee Count</span>
                    <p className="text-sm">👥 {interview.companyInfo.employeeCount}</p>
                  </div>
                )}

                {interview.companyInfo.revenue && (
                  <div>
                    <span className="text-sm font-semibold">Revenue</span>
                    <p className="text-sm">💰 {interview.companyInfo.revenue}</p>
                  </div>
                )}

                {interview.companyInfo.avgSalary && (
                  <div>
                    <span className="text-sm font-semibold">Average Salary</span>
                    <p className="text-sm text-success font-semibold">{interview.companyInfo.avgSalary}</p>
                  </div>
                )}

                {interview.companyInfo.fundingTotal && (
                  <div>
                    <span className="text-sm font-semibold">Total Funding</span>
                    <p className="text-sm">{interview.companyInfo.fundingTotal}</p>
                  </div>
                )}

                {interview.companyInfo.lastFunding && (
                  <div>
                    <span className="text-sm font-semibold">Last Funding</span>
                    <p className="text-sm">{interview.companyInfo.lastFunding}</p>
                  </div>
                )}
              </div>

              {interview.companyInfo.investors && interview.companyInfo.investors.length > 0 && (
                <div className="mt-4">
                  <span className="text-sm font-semibold block mb-2">Investors</span>
                  <div className="flex flex-wrap gap-2">
                    {interview.companyInfo.investors.map((investor, idx) => (
                      <span key={idx} className="badge badge-outline">{investor}</span>
                    ))}
                  </div>
                </div>
              )}

              {interview.companyInfo.benefits && interview.companyInfo.benefits.length > 0 && (
                <div className="mt-4">
                  <span className="text-sm font-semibold block mb-2">Benefits</span>
                  <div className="flex flex-wrap gap-2">
                    {interview.companyInfo.benefits.map((benefit, idx) => (
                      <span key={idx} className="badge badge-success badge-outline">{benefit}</span>
                    ))}
                  </div>
                </div>
              )}

              {interview.companyInfo.updatedAt && (
                <div className="mt-4 pt-4 border-t border-base-300">
                  <p className="text-xs text-base-content/50">
                    Company data last updated: {formatDate(interview.companyInfo.updatedAt)}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="divider"></div>

        {/* Timeline */}
        <div className="mb-6">
          <h4 className="text-lg font-bold mb-4">Timeline</h4>

          {timeline.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              <p>No timeline entries yet. Add your first note below!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {timeline.map((entry) => (
                <div key={entry.id} className="card bg-base-200">
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {entry.statusChange && (
                          <div className="mb-2">
                            <span className="text-sm font-semibold">Status changed to: </span>
                            <span className={`badge ${STATUS_COLORS[entry.statusChange]}`}>
                              {STATUS_LABELS[entry.statusChange]}
                            </span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{entry.comment}</p>

                        {/* File attachment */}
                        {entry.attachmentUrl && entry.attachmentName && (
                          <div className="mt-3 p-2 bg-base-300 rounded">
                            <a
                              href={entry.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary text-sm flex items-center gap-2"
                            >
                              📎 {entry.attachmentName}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-base-content/60 ml-4">
                        {formatDate(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Timeline Entry Form */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h5 className="font-semibold mb-2">Add Timeline Entry</h5>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Add a note, update, or comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />

            {/* File attachment input with drag-and-drop */}
            <div
              className={`mt-2 border-2 border-dashed rounded-lg p-4 transition-colors ${isDraggingOver
                ? 'border-primary bg-primary/10'
                : 'border-base-300 bg-base-100'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center">
                <p className="text-sm text-base-content/70 mb-2">
                  {isDraggingOver
                    ? '📎 Drop file here...'
                    : '📎 Drag & drop a file or click to browse'}
                </p>
                <input
                  type="file"
                  className="file-input file-input-bordered file-input-sm w-full"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
              {selectedFile && (
                <div className="mt-3 p-2 bg-base-200 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/90">✅ {selectedFile.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setSelectedFile(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="card-actions justify-end mt-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isAddingEntry || !newComment.trim()}
                onClick={handleAddTimelineEntry}
              >
                {isAddingEntry ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    Adding...
                  </>
                ) : (
                  'Add Entry'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="divider"></div>

        {/* Reminders Section */}
        <div className="mb-6">
          <h4 className="text-lg font-bold mb-4">⏰ Reminders</h4>

          {reminders.length === 0 ? (
            <div className="text-center py-4 text-base-content/60 text-sm">
              <p>No reminders set. Add one below!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => {
                const isOverdue = !reminder.completed && new Date(reminder.dueAt) < new Date();
                const dueDate = new Date(reminder.dueAt);

                return (
                  <div
                    key={reminder.id}
                    className={`flex items-center gap-3 p-3 rounded ${reminder.completed
                      ? 'bg-success/10'
                      : isOverdue
                        ? 'bg-error/10'
                        : 'bg-base-200'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={reminder.completed}
                      onChange={(e) => handleToggleReminder(reminder.id, e.target.checked)}
                      className="checkbox checkbox-sm"
                    />
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${reminder.completed ? 'line-through text-base-content/50' : ''
                          }`}
                      >
                        {reminder.title}
                      </p>
                      <p className="text-xs text-base-content/60">
                        Due: {dueDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {isOverdue && !reminder.completed && (
                          <span className="text-error font-semibold ml-2">⚠️ Overdue</span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleDeleteReminder(reminder.id)}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Reminder Form */}
          <div className="card bg-base-200 mt-4">
            <div className="card-body p-4">
              <h5 className="font-semibold mb-2">Add New Reminder</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="Reminder title (e.g., 'Follow up')"
                  value={newReminderTitle}
                  onChange={(e) => setNewReminderTitle(e.target.value)}
                />
                <input
                  type="datetime-local"
                  className="input input-bordered input-sm"
                  value={newReminderDate}
                  onChange={(e) => setNewReminderDate(e.target.value)}
                />
              </div>
              <div className="card-actions justify-end mt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isAddingReminder || !newReminderTitle.trim() || !newReminderDate}
                  onClick={handleAddReminder}
                >
                  {isAddingReminder ? (
                    <>
                      <span className="loading loading-spinner loading-xs"></span>
                      Adding...
                    </>
                  ) : (
                    '⏰ Add Reminder'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>,
    document.body
  );
}
