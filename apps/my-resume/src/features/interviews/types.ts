export const INTERVIEW_STATUS = {
  APPLIED: 'APPLIED',
  SCREENING: 'SCREENING',
  TECHNICAL: 'TECHNICAL',
  ONSITE: 'ONSITE',
  FINAL_ROUND: 'FINAL_ROUND',
  OFFER: 'OFFER',
  NEGOTIATING: 'NEGOTIATING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export type InterviewStatus = typeof INTERVIEW_STATUS[keyof typeof INTERVIEW_STATUS];

export const STATUS_LABELS: Record<InterviewStatus, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  TECHNICAL: 'Technical',
  ONSITE: 'Onsite',
  FINAL_ROUND: 'Final Round',
  OFFER: 'Offer Received',
  NEGOTIATING: 'Negotiating',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const STATUS_COLORS: Record<InterviewStatus, string> = {
  APPLIED: 'badge-info',
  SCREENING: 'badge-primary',
  TECHNICAL: 'badge-secondary',
  ONSITE: 'badge-accent',
  FINAL_ROUND: 'badge-warning',
  OFFER: 'badge-success',
  NEGOTIATING: 'badge-warning',
  ACCEPTED: 'badge-success',
  REJECTED: 'badge-error',
  WITHDRAWN: 'badge-ghost',
};

export interface Interview {
  id: string;
  company: string;
  position: string;
  jobUrl?: string;
  description?: string;
  status: InterviewStatus;
  skillTags: string[];
  resumeId?: string;
  recruiterName?: string;
  recruiterEmail?: string;
  recruiterPhone?: string;
  recruiterLinks?: string[];
  appliedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  resume?: {
    id: string;
    title: string;
    slug: string;
  };
  timeline?: TimelineEntry[];
}

export interface TimelineEntry {
  id: string;
  comment: string;
  statusChange?: InterviewStatus;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  createdAt: string;
}

export interface InterviewStats {
  totalActive: number;
  totalThisMonth: number;
  recentActivity: number;
  byStatus: Record<string, number>;
}
