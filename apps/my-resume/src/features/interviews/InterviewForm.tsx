import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../shared/api/client';
import type { Interview, InterviewStatus, Template, CompanyInfo } from './types';
import { INTERVIEW_STATUS } from './types';

interface InterviewFormProps {
  interview: Interview | null;
  onSave: (interview: Interview) => void;
  onCancel: () => void;
}

export function InterviewForm({ interview, onSave, onCancel }: InterviewFormProps) {
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

  // Company enrichment state
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(interview?.companyInfo || null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [enrichmentJobId, setEnrichmentJobId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
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
        setEnrichmentError('Company research failed. Data may be limited.');
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
      alert(err.message || 'Failed to save interview');
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
      alert('Please enter a template name');
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
      alert('Template saved successfully!');
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div
        className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full flex flex-col overflow-hidden"
        style={{ position: 'relative', zIndex: 10000, maxHeight: 'calc(100vh - 4rem)', height: 'auto' }}
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
              {interview ? 'Edit Interview' : 'New Interview'}
            </h2>

            {/* Templates Section */}
            {!interview && templates.length > 0 && (
              <div className="mb-4 p-4 bg-base-200 rounded-lg">
                <label className="label">
                  <span className="label-text font-semibold">📋 Load from Template</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  onChange={(e) => handleLoadTemplate(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a template...
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
                  <span className="label-text">Company *</span>
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
                  <span className="label-text">Position *</span>
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

            {/* Company Enrichment Display */}
            {isEnriching && (
              <div className="alert alert-info mb-4">
                <span className="loading loading-spinner loading-sm"></span>
                <div>
                  <span className="font-semibold">🔍 Researching company...</span>
                  <p className="text-xs opacity-70">
                    This may take 10-30 seconds. You'll receive an email when complete.
                  </p>
                </div>
              </div>
            )}

            {enrichmentError && (
              <div className="alert alert-warning mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Could not fetch company info. You can continue without it.</span>
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
                <span className="label-text">Job URL</span>
              </label>
              <input
                type="url"
                className="input input-bordered"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Status & Applied Date */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Status</span>
                </label>
                <select
                  className="select select-bordered"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InterviewStatus)}
                >
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
                <label className="label">
                  <span className="label-text">Applied Date</span>
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
                <span className="label-text">Description / Notes</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role details, salary range, benefits, etc."
              />
            </div>

            {/* Skills Tags */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Skills / Technologies</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  placeholder="e.g., Python, React, AWS..."
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleAddSkill}
                >
                  Add
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
            <div className="divider">Recruiter Contact (Optional)</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Name</span>
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
                  <span className="label-text">Email</span>
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
                  <span className="label-text">Phone</span>
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
              💾 Save as Template
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : interview ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Template Save Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
          <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full overflow-y-auto" style={{ position: 'relative', zIndex: 10002, maxHeight: 'calc(100vh - 4rem)' }}>
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
              <h3 className="text-xl font-bold mb-4 pr-8">Save as Template</h3>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Template Name *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="e.g., Software Engineer - FAANG"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={isSavingTemplate}
                />
              </div>

              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Description (optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="Brief description of this template..."
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
                  Cancel
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
                    'Save Template'
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
