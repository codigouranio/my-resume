import type { Interview } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';

interface InterviewCardProps {
  interview: Interview;
  onEdit: (interview: Interview) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

export function InterviewCard({ interview, onEdit, onDelete, onArchive }: InterviewCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="card bg-base-100 shadow hover:shadow-lg transition-shadow">
      <div className="card-body">
        {/* Header */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h3 className="card-title text-lg">{interview.company}</h3>
            <p className="text-sm text-base-content/70">{interview.position}</p>
          </div>
          <div className={`badge ${STATUS_COLORS[interview.status]} badge-sm`}>
            {STATUS_LABELS[interview.status]}
          </div>
        </div>

        {/* Job Link */}
        {interview.jobUrl && (
          <a
            href={interview.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary text-sm mt-1"
          >
            View Job Posting →
          </a>
        )}

        {/* Description */}
        {interview.description && (
          <p className="text-sm text-base-content/60 line-clamp-2 mt-2">
            {interview.description}
          </p>
        )}

        {/* Skills */}
        {interview.skillTags && interview.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {interview.skillTags.slice(0, 3).map((skill, idx) => (
              <span key={idx} className="badge badge-outline badge-sm">
                {skill}
              </span>
            ))}
            {interview.skillTags.length > 3 && (
              <span className="badge badge-ghost badge-sm">
                +{interview.skillTags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Resume */}
        {interview.resume && (
          <p className="text-xs text-base-content/50 mt-2">
            📄 {interview.resume.title}
          </p>
        )}

        {/* Date */}
        <p className="text-xs text-base-content/50 mt-2">
          Applied: {formatDate(interview.appliedAt)}
        </p>

        {/* Actions */}
        <div className="card-actions justify-end mt-4 border-t pt-4">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(interview)}
          >
            ✏️ Edit
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onArchive(interview.id)}
          >
            📦 Archive
          </button>
          <button
            className="btn btn-ghost btn-sm text-error"
            onClick={() => onDelete(interview.id)}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}
