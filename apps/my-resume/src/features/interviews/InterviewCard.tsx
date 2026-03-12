import type { Interview } from './types';
import { STATUS_LABELS, STATUS_COLORS } from './types';
import { useTranslation } from 'react-i18next';

interface InterviewCardProps {
  interview: Interview;
  onEdit: (interview: Interview) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, isArchived: boolean) => void;
  onView: () => void;
}

export function InterviewCard({ interview, onEdit, onDelete, onArchive, onView }: InterviewCardProps) {
  const { t } = useTranslation();
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
          <div className="flex-1 flex items-start gap-3">
            {/* Company Logo */}
            {interview.companyInfo?.logoUrl && (
              <img
                src={interview.companyInfo.logoUrl}
                alt={`${interview.company} logo`}
                className="w-12 h-12 rounded object-contain bg-white border border-base-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="card-title text-lg">{interview.company}</h3>
                {interview.companyInfo?.linkedinUrl && (
                  <a
                    href={interview.companyInfo.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-circle btn-ghost"
                    title="LinkedIn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗
                  </a>
                )}
              </div>
              <p className="text-sm text-base-content/70">{interview.position}</p>
              {/* Company Info Badges */}
              {interview.companyInfo && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* Enrichment Status Badges */}
                  {interview.companyInfo.enrichmentStatus === 'PENDING' && (
                    <span className="badge badge-xs badge-info">
                      🔄 Researching...
                    </span>
                  )}
                  {interview.companyInfo.enrichmentStatus === 'PROCESSING' && (
                    <span className="badge badge-xs badge-warning">
                      ⏳ Processing...
                    </span>
                  )}
                  {interview.companyInfo.enrichmentStatus === 'COMPLETED' && (
                    <span className="badge badge-xs badge-success">
                      ✓ Enriched
                    </span>
                  )}
                  {interview.companyInfo.enrichmentStatus === 'FAILED' && (
                    <span className="badge badge-xs badge-error">
                      ❌ Failed
                    </span>
                  )}
                  {interview.companyInfo.companySize && (
                    <span className="badge badge-xs badge-primary">
                      {interview.companyInfo.companySize}
                    </span>
                  )}
                  {interview.companyInfo.glassdoorRating && (
                    <span className="badge badge-xs">
                      ⭐ {interview.companyInfo.glassdoorRating}
                    </span>
                  )}
                  {interview.companyInfo.industry && (
                    <span className="badge badge-xs badge-outline">
                      {interview.companyInfo.industry}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`badge ${STATUS_COLORS[interview.status]} badge-sm`}>
              {STATUS_LABELS[interview.status]}
            </div>
            {/* Fit Score Badge */}
            {interview.fitScore !== undefined && interview.fitScore !== null && (
              <div
                className={`badge badge-lg font-bold ${interview.fitScore >= 8
                  ? 'badge-success'
                  : interview.fitScore >= 6
                    ? 'badge-warning'
                    : 'badge-error'
                  }`}
                title="AI Position Fit Score"
              >
                🎯 {interview.fitScore.toFixed(1)}/10
              </div>
            )}
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
            {t('interviews.job_posting')} →
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
                +{interview.skillTags.length - 3} {t('interviews.more_skills')}
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

        {/* Company Metadata */}
        {interview.companyInfo && (interview.companyInfo.employeeCount || interview.companyInfo.avgSalary) && (
          <div className="flex flex-wrap gap-3 text-xs text-base-content/60 mt-2">
            {interview.companyInfo.employeeCount && (
              <span>👥 {interview.companyInfo.employeeCount}</span>
            )}
            {interview.companyInfo.avgSalary && (
              <span className="text-success">💰 {interview.companyInfo.avgSalary}</span>
            )}
          </div>
        )}

        {/* Date */}
        <p className="text-xs text-base-content/50 mt-2">
          {t('interviews.applied')}: {formatDate(interview.appliedAt)}
        </p>

        {/* Actions */}
        <div className="card-actions justify-end mt-4 border-t pt-4">
          <button
            className="btn btn-primary btn-sm"
            onClick={onView}
          >
            👁️ {t('interviews.view_details')}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(interview)}
          >
            ✏️ {t('common.edit')}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onArchive(interview.id, !!interview.archivedAt)}
          >
            {interview.archivedAt ? `📂 ${t('common.unarchive')}` : `📦 ${t('common.archive')}`}
          </button>
          <button
            className="btn btn-ghost btn-sm text-error"
            onClick={() => onDelete(interview.id)}
          >
            🗑️ {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
