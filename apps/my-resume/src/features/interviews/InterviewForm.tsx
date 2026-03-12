import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../../shared/api/client';
import type { Interview, InterviewStatus, Template, CompanyInfo } from './types';
import { INTERVIEW_STATUS } from './types';

interface InterviewFormProps {
  interview: Interview | null;
  onSave: (interview: Interview) => void;
  onCancel: () => void;
}

export function InterviewForm({ interview, onSave, onCancel }: InterviewFormProps) {
  const { t } = useTranslation();
  const [company, setCompany] = useState(interview?.company || '');
  const [position, setPosition] = useState(interview?.position || '');
  const [jobUrl, setJobUrl] = useState(interview?.jobUrl || '');
  const [description, setDescription] = useState(interview?.description || '');
  const [status, setStatus] = useState<InterviewStatus>(interview?.status || INTERVIEW_STATUS.APPLIED);
  const [skillTags, setSkillTags] = useState<string[]>(interview?.skillTags || []);
  const [skillInput, setSkillInput] = useState('');
  const [recruiterName, setRecruiterName] = useState(interview?.recruiterName || '');
  const [recruiterEmail, setRecruiterEmail] = useState(interview?.recruiterEmail || '');
  const [recruiterPhone, setRecruiterPhone] = useState(interview?.recruiterPhone || '');
  const [appliedAt, setAppliedAt] = useState(
    interview?.appliedAt ? new Date(interview.appliedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // Resume selection
  const [resumes, setResumes] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>(interview?.resumeId || '');

  // Company enrichment state
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(interview?.companyInfo || null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    loadResumes();
  }, []);

  // Auto-enrich company info when company name changes (debounced)
  useEffect(() => {
    // Skip if company name is too short or if we're editing an existing interview with company info
    if (!company || company.length < 3) {
      setCompanyInfo(null);
      setEnrichmentError(null);
      setEnrichmentJobId(null);
      return;
    }

    // If editing existing interview, check if company info already loaded
    if (interview?.companyInfo && interview.companyInfo.companyName === company) {
      setCompanyInfo(interview.companyInfo);
      return;
    }

    // Debounce: wait 1 second after user stops typing
    const timer = setTimeout(async () => {
      setIsEnriching(true);
      setEnrichmentError(null);

      try {
        // First check cache
        const cachedInfo = await apiClient.getCompanyInfo(company);
        setCompanyInfo(cachedInfo);
        setIsEnriching(false);
      } catch (cacheError) {
        // Not in cache, queue enrichment job (non-blocking)
        try {
          const { jobId } = await apiClient.queueCompanyEnrichment(company);
          setEnrichmentJobId(jobId);

          // Start polling for job completion
          pollEnrichmentJob(jobId);
        } catch (queueError: any) {
          console.error('Failed to queue enrichment:', queueError);
          setEnrichmentError(queueError.message || 'Failed to queue company research');
          setIsEnriching(false);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [company, interview?.companyInfo]);

  // Poll enrichment job status
  const pollEnrichmentJob = async (jobId: string) => {
    try {
      const status = await apiClient.getEnrichmentJobStatus(jobId);

      if (status.status === 'completed' && status.result?.success) {
        setCompanyInfo(status.result.data);
        setIsEnriching(false);
        setEnrichmentJobId(null);
      } else if (status.status === 'failed') {
        setEnrichmentError(t('interviews.enrichment_failed'));
        setIsEnriching(false);
        setEnrichmentJobId(null);
      } else {
        // Still processing, check again in 3 seconds
        setTimeout(() => pollEnrichmentJob(jobId), 3000);
      }
    } catch (error: any) {
      console.error('Failed to check job status:', error);
      setEnrichmentError('Failed to check research status');
      setIsEnriching(false);
      setEnrichmentJobId(null);
    }
  };

  const handleAddSkill = () => {
    const skill = skillInput.trim();
    if (skill && !skillTags.includes(skill)) {
      setSkillTags([...skillTags, skill]);
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkillTags(skillTags.filter((s) => s !== skill));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const data = {
        company,
        position,
        jobUrl: jobUrl || undefined,
        description: description || undefined,
        status,
        skillTags,
        resumeId: selectedResumeId || undefined,
        recruiterName: recruiterName || undefined,
        recruiterEmail: recruiterEmail || undefined,
        recruiterPhone: recruiterPhone || undefined,
        appliedAt,
      };

      const result = interview
        ? await apiClient.updateInterview(interview.id, data)
        : await apiClient.createInterview(data);

      // Auto-trigger position fit scoring if jobUrl or description provided
      if (data.jobUrl || data.description) {
        try {
          await apiClient.queuePositionScoring({
            interviewId: result.id,
            company: data.company,
            position: data.position,
            jobUrl: data.jobUrl,
            jobDescription: data.description,
          });
          console.log('Position fit scoring queued for interview:', result.id);
        } catch (scoringError) {
          // Don't fail the save if scoring fails
          console.error('Failed to queue position scoring:', scoringError);
        }
      }

      onSave(result);
    } catch (err: any) {
      alert(err.message || t('interviews.failed_save'));
    } finally {
      setIsSaving(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await apiClient.getInterviewTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadResumes = async () => {
    try {
      const data = await apiClient.getMyResumes();
      setResumes(data);

      // If editing and resume is already associated, keep it selected
      if (interview?.resumeId) {
        setSelectedResumeId(interview.resumeId);
      }
    } catch (error) {
      console.error('Failed to load resumes:', error);
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setCompany(template.company || '');
    setPosition(template.position || '');
    setJobUrl(template.jobUrl || '');
    setDescription(template.templateDescription || '');
    setSkillTags(template.skillTags || []);
    setRecruiterName(template.recruiterName || '');
    setRecruiterEmail(template.recruiterEmail || '');
    setRecruiterPhone(template.recruiterPhone || '');
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      alert(t('interviews.enter_template_name'));
      return;
    }

    setIsSavingTemplate(true);
    try {
      await apiClient.createInterviewTemplate({
        name: templateName,
        description: templateDescription || undefined,
        company: company || undefined,
        position: position || undefined,
        jobUrl: jobUrl || undefined,
        templateDescription: description || undefined,
        skillTags,
        recruiterName: recruiterName || undefined,
        recruiterEmail: recruiterEmail || undefined,
        recruiterPhone: recruiterPhone || undefined,
      });

      setShowTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      await loadTemplates();
      alert(t('interviews.template_saved'));
    } catch (error) {
      console.error('Failed to save template:', error);
      alert(t('interviews.template_save_failed'));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 100000 }}>
      <div
        className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full flex flex-col overflow-hidden"
        style={{ position: 'relative', zIndex: 100001, maxHeight: 'calc(100vh - 4rem)', height: 'auto' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          style={{ zIndex: 10 }}
          disabled={isSaving}
        >
          ✕
        </button>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            <h2 className="text-2xl font-bold mb-4 pr-8">
              {interview ? t('interviews.edit_interview') : t('interviews.new_interview')}
            </h2>

            {/* Templates Section */}
            {!interview && templates.length > 0 && (
              <div className="mb-4 p-4 bg-base-200 rounded-lg">
                <label className="label">
                  <span className="label-text font-semibold">📋 {t('interviews.load_template')}</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t('interviews.select_template_placeholder')}
                  </option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} {template.description && `- ${template.description}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Company & Position */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('interviews.company')} *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  required
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('interviews.position')} *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Resume Selection */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">{t('interviews.resume_used')}</span>
                <span className="label-text-alt text-base-content/60">{t('common.optional')}</span>
              </label>
              <select
                className="select select-bordered"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                <option value="">{t('interviews.no_resume_selected')}</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                  </option>
                ))}
              </select>
              {selectedResumeId && (
                <label className="label">
                  <span className="label-text-alt text-success">
                    ✓ {t('interviews.resume_helper')}
                  </span>
                </label>
              )}
            </div>

            {/* Company Enrichment Display */}
            {isEnriching && (
              <div className="alert alert-info mb-4">
                <span className="loading loading-spinner loading-sm"></span>
                <div>
                  <span className="font-semibold">{t('interviews.enrichment_researching')}</span>
                  <p className="text-xs opacity-70">
                    {t('interviews.enrichment_wait_message')}
                  </p>
                </div>
              </div>
            )}

            {enrichmentError && (
              <div className="alert alert-warning mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{t('interviews.enrichment_warning')}</span>
              </div>
            )}

            {companyInfo && !isEnriching && (
              <div className="alert alert-success mb-4 shadow-lg">
                <div className="flex items-start gap-4 w-full">
                  {companyInfo.logoUrl && (
                    <img
                      src={companyInfo.logoUrl}
                      alt={`${company} logo`}
                      className="w-16 h-16 rounded object-contain bg-white"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-lg">{company}</h4>
                      {companyInfo.linkedinUrl && (
                        <a
                          href={companyInfo.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-ghost"
                          title="LinkedIn"
                        >
                          🔗
                        </a>
                      )}
                    </div>
                    {companyInfo.description && (
                      <p className="text-sm opacity-80 mb-2 line-clamp-2">
                        {companyInfo.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {companyInfo.industry && (
                        <span className="badge badge-sm">{companyInfo.industry}</span>
                      )}
                      {companyInfo.companySize && (
                        <span className="badge badge-sm badge-primary">{companyInfo.companySize}</span>
                      )}
                      {companyInfo.employeeCount && (
                        <span className="badge badge-sm">👥 {companyInfo.employeeCount}</span>
                      )}
                      {companyInfo.avgSalary && (
                        <span className="badge badge-sm badge-success">💰 {companyInfo.avgSalary}</span>
                      )}
                      {companyInfo.glassdoorRating && (
                        <span className="badge badge-sm">⭐ {companyInfo.glassdoorRating}</span>
                      )}
                      {companyInfo.founded && (
                        <span className="badge badge-sm">📅 Founded {companyInfo.founded}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Job URL */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('interviews.job_url')}</span>
              </label>
              <input
                type="url"
                className="input input-bordered"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder={t('interviews.job_url_placeholder')}
              />
            </div>

            {/* Status & Applied Date */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('interviews.status')}</span>
                </label>
                <select
                  className="select select-bordered"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InterviewStatus)}
                >
                  <option value="APPLIED">{t('interviews.status_applied')}</option>
                  <option value="SCREENING">{t('interviews.status_screening')}</option>
                  <option value="TECHNICAL">{t('interviews.status_technical')}</option>
                  <option value="ONSITE">{t('interviews.status_onsite')}</option>
                  <option value="FINAL_ROUND">{t('interviews.status_final_round')}</option>
                  <option value="OFFER">{t('interviews.status_offer')}</option>
                  <option value="NEGOTIATING">{t('interviews.status_negotiating')}</option>
                  <option value="ACCEPTED">{t('interviews.status_accepted')}</option>
                  <option value="REJECTED">{t('interviews.status_rejected')}</option>
                  <option value="WITHDRAWN">{t('interviews.status_withdrawn')}</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('interviews.applied_date')}</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={appliedAt}
                  onChange={(e) => setAppliedAt(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('interviews.description_notes')}</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('interviews.description_placeholder')}
              />
            </div>

            {/* Skills Tags */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">{t('interviews.skills_technologies')}</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  placeholder={t('interviews.skills_placeholder')}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAddSkill}
                >
                  {t('common.add')}
                </button>
              </div>
              {skillTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {skillTags.map((skill) => (
                    <span key={skill} className="badge badge-primary gap-1">
                      {skill}
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => handleRemoveSkill(skill)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recruiter Info */}
            <div className="divider">{t('interviews.recruiter_contact_optional')}</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('common.name')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('common.email')}</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered"
                  value={recruiterEmail}
                  onChange={(e) => setRecruiterEmail(e.target.value)}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">{t('common.phone')}</span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered"
                  value={recruiterPhone}
                  onChange={(e) => setRecruiterPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between p-6 border-t flex-shrink-0 bg-base-100">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowTemplateModal(true)}
              disabled={isSaving || !company || !position}
            >
              {t('interviews.save_as_template')}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={isSaving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : interview ? (
                  t('common.update')
                ) : (
                  t('common.create')
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Template Save Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 100002 }}>
          <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full overflow-y-auto" style={{ position: 'relative', zIndex: 100003, maxHeight: 'calc(100vh - 4rem)' }}>
            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowTemplateModal(false);
                setTemplateName('');
                setTemplateDescription('');
              }}
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              style={{ zIndex: 10 }}
              disabled={isSavingTemplate}
            >
              ✕
            </button>
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4 pr-8">{t('interviews.save_template_title')}</h3>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">{t('interviews.template_name_required')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder={t('interviews.template_name_placeholder')}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={isSavingTemplate}
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">{t('interviews.template_description_optional')}</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder={t('interviews.template_description_placeholder')}
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={2}
                  disabled={isSavingTemplate}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setTemplateName('');
                    setTemplateDescription('');
                  }}
                  disabled={isSavingTemplate}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveAsTemplate}
                  disabled={isSavingTemplate || !templateName.trim()}
                >
                  {isSavingTemplate ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    t('interviews.save_template_button')
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
