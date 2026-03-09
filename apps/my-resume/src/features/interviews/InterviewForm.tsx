import { useState } from 'react';
import { apiClient } from '../../shared/api/client';
import type { Interview, InterviewStatus } from './types';
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

      onSave(result);
    } catch (err: any) {
      alert(err.message || 'Failed to save interview');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full my-8">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">
              {interview ? 'Edit Interview' : 'New Interview'}
            </h2>

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
          <div className="flex justify-end gap-2 p-6 border-t">
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
        </form>
      </div>
    </div>
  );
}
