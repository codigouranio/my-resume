const API_BASE_URL = import.meta.env.PUBLIC_API_URL || '/api';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<any> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  setRefreshToken(refreshToken: string | null) {
    this.refreshToken = refreshToken;
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    headers['X-Referer-URL'] = window.location.href;

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // If 401 and we have a refresh token, try to refresh
    if (
      response.status === 401 &&
      this.refreshToken &&
      !endpoint.includes('/auth/')
    ) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${this.token}`;
        response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  private async tryRefreshToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      await this.refreshPromise;
      return true;
    }

    try {
      this.refreshPromise = fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      const response = await this.refreshPromise;
      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access_token);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    } finally {
      this.refreshPromise = null;
    }

    // Refresh failed, clear tokens
    this.setToken(null);
    this.setRefreshToken(null);
    return false;
  }

  // Auth
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refresh() {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
    } finally {
      this.setToken(null);
      this.setRefreshToken(null);
    }
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Users
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async updateCurrentUser(data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    customDomain?: string | null;
    defaultResumeId?: string | null;
  }) {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async checkSubdomainAvailability(subdomain: string) {
    return this.request(
      `/users/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`,
    );
  }

  async deleteAccount() {
    return this.request('/users/me', {
      method: 'DELETE',
    });
  }

  // Resumes
  async getMyResumes() {
    return this.request('/resumes');
  }

  async getResume(id: string) {
    return this.request(`/resumes/${id}`);
  }

  async getPublicResume(slug: string) {
    return this.request(`/resumes/public/${slug}?view=true`);
  }

  async getPublicResumeStats(slug: string) {
    return this.request(`/resumes/public/${slug}/stats`);
  }

  async getResumeByDomain(domain: string) {
    return this.request(`/resumes/by-domain/${domain}?view=true`);
  }

  async checkSlugAvailability(slug: string) {
    return this.request(`/resumes/public/${slug}`);
  }

  async getResumeForLLM(slug: string) {
    return this.request(`/resumes/llm/${slug}`);
  }

  async createResume(data: {
    slug: string;
    title: string;
    content: string;
    llmContext?: string;
    isPublic?: boolean;
    isPublished?: boolean;
    theme?: string;
  }) {
    return this.request('/resumes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateResume(
    id: string,
    data: Partial<{
      slug: string;
      title: string;
      content: string;
      llmContext?: string;
      isPublic?: boolean;
      isPublished?: boolean;
      theme?: string;
    }>,
  ) {
    return this.request(`/resumes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteResume(id: string) {
    return this.request(`/resumes/${id}`, {
      method: 'DELETE',
    });
  }

  async getResumeAnalytics(id: string) {
    return this.request(`/resumes/${id}/analytics`);
  }

  // AI Text Improvement
  async improveText(text: string, context: string = 'resume') {
    return this.request('/resumes/improve-text', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }

  // Recruiter Interest
  async submitRecruiterInterest(data: {
    resumeSlug: string;
    name: string;
    email: string;
    company?: string;
    message: string;
  }) {
    return this.request('/resumes/recruiter-interest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRecruiterInterests() {
    return this.request('/resumes/recruiter-interest/my-interests');
  }

  async markInterestAsRead(id: string) {
    return this.request(`/resumes/recruiter-interest/${id}/read`, {
      method: 'PATCH',
    });
  }

  async toggleFavoriteInterest(id: string) {
    return this.request(`/resumes/recruiter-interest/${id}/favorite`, {
      method: 'PATCH',
    });
  }

  async deleteRecruiterInterest(id: string) {
    return this.request(`/resumes/recruiter-interest/${id}`, {
      method: 'DELETE',
    });
  }

  // Subscriptions (Stripe)
  async createCheckoutSession(priceId: string | null) {
    return this.request('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }

  async getPriceDetails(priceId: string | null) {
    return this.request(`/subscriptions/prices/${priceId}`);
  }

  async createPortalSession() {
    return this.request('/subscriptions/portal', {
      method: 'POST',
    });
  }

  // Templates
  async getTemplates() {
    return this.request('/templates');
  }

  async getTemplate(id: string) {
    return this.request(`/templates/${id}`);
  }

  // Chat Analytics
  async getChatAnalyticsSummary(resumeId: string, days: number = 30) {
    return this.request(`/analytics/chat/${resumeId}/summary?days=${days}`);
  }

  async getChatTopics(resumeId: string) {
    return this.request(`/analytics/chat/${resumeId}/topics`);
  }

  async getChatLearningGaps(resumeId: string) {
    return this.request(`/analytics/chat/${resumeId}/learning-gaps`);
  }

  async getChatTrends(
    resumeId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    startDate?: string,
    endDate?: string,
  ) {
    let url = `/analytics/chat/${resumeId}/trends?period=${period}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return this.request(url);
  }

  async getChatInteractions(
    resumeId: string,
    startDate?: string,
    endDate?: string,
    sentiment?: string,
  ) {
    let url = `/analytics/chat/${resumeId}/interactions?`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (sentiment) url += `&sentiment=${sentiment}`;
    return this.request(url);
  }

  async getBasicAnalytics(resumeId: string) {
    return this.request(`/resumes/${resumeId}`);
  }

  async getDetailedAnalytics(resumeId: string) {
    return this.request(`/resumes/${resumeId}/analytics/detailed`);
  }

  // AI Context
  async createAIContextPost(text: string, publishedAt?: string, includeInAI?: boolean, isPublic?: boolean) {
    return this.request('/ai-context/posts', {
      method: 'POST',
      body: JSON.stringify({ text, publishedAt, includeInAI, isPublic }),
    });
  }

  async getAIContextPosts(search?: string, includeInAI?: boolean, resumeId?: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (includeInAI !== undefined) params.append('includeInAI', String(includeInAI));
    if (resumeId) params.append('resumeId', resumeId);
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    const query = params.toString();
    return this.request(`/ai-context/posts${query ? '?' + query : ''}`);
  }

  async getPublicPosts(userId: string, limit?: number, offset?: number) {
    const params = new URLSearchParams();
    params.append('isPublic', 'true');
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    const query = params.toString();
    return this.request(`/ai-context/public/${userId}${query ? '?' + query : ''}`);
  }

  async getAIContextPost(postId: string) {
    return this.request(`/ai-context/posts/${postId}`);
  }

  async updateAIContextPost(postId: string, text?: string, publishedAt?: string, includeInAI?: boolean, isPublic?: boolean) {
    return this.request(`/ai-context/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify({ text, publishedAt, includeInAI, isPublic }),
    });
  }

  async deleteAIContextPost(postId: string) {
    return this.request(`/ai-context/posts/${postId}`, {
      method: 'DELETE',
    });
  }

  async addAIContextReaction(postId: string, reactionType: string, customEmoji?: string) {
    return this.request(`/ai-context/posts/${postId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reactionType, customEmoji }),
    });
  }

  async removeAIContextReaction(postId: string, reactionType: string, customEmoji?: string) {
    return this.request(`/ai-context/posts/${postId}/reactions`, {
      method: 'DELETE',
      body: JSON.stringify({ reactionType, customEmoji }),
    });
  }

  async addAIContextReply(postId: string, text: string) {
    return this.request(`/ai-context/posts/${postId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async getAIContextReplies(postId: string) {
    return this.request(`/ai-context/posts/${postId}/replies`);
  }

  async updateAIContextReply(postId: string, replyId: string, text: string) {
    return this.request(`/ai-context/posts/${postId}/replies/${replyId}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    });
  }

  async deleteAIContextReply(postId: string, replyId: string) {
    return this.request(`/ai-context/posts/${postId}/replies/${replyId}`, {
      method: 'DELETE',
    });
  }

  async tagPostToResume(postId: string, resumeId: string) {
    return this.request(`/ai-context/posts/${postId}/resume-tags`, {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });
  }

  async removePostResumeTag(postId: string, resumeId: string) {
    return this.request(`/ai-context/posts/${postId}/resume-tags/${resumeId}`, {
      method: 'DELETE',
    });
  }

  async getAIContextString(resumeId?: string) {
    const query = resumeId ? `?resumeId=${resumeId}` : '';
    return this.request(`/ai-context/context${query}`);
  }

  async addAIContextAttachment(postId: string, fileUrl: string, fileName: string, fileType: string, fileSizeBytes?: number) {
    return this.request(`/ai-context/posts/${postId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ fileUrl, fileName, fileType, fileSizeBytes }),
    });
  }

  async removeAIContextAttachment(postId: string, attachmentId: string) {
    return this.request(`/ai-context/posts/${postId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  async identifySlug(): Promise<{ slug: string | null }> {
    return this.request('/resumes/identify-slug');
  }

  // Document Storage
  async uploadDocument(file: File): Promise<{ fileKey: string; embedCode: string; viewUrl: string; downloadUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const response = await fetch(`${this.baseURL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload document');
    }

    return response.json();
  }

  async deleteDocument(userId: string, fileName: string) {
    return this.request(`/documents/${userId}/${fileName}`, {
      method: 'DELETE',
    });
  }

  // Interview Tracking
  async createInterview(data: any) {
    return this.request('/interviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviews(filters?: { status?: string; company?: string; archived?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.company) params.append('company', filters.company);
    if (filters?.archived !== undefined) params.append('archived', String(filters.archived));
    const query = params.toString();
    return this.request(`/interviews${query ? '?' + query : ''}`);
  }

  async getInterview(id: string) {
    return this.request(`/interviews/${id}`);
  }

  async updateInterview(id: string, data: any) {
    return this.request(`/interviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInterview(id: string) {
    return this.request(`/interviews/${id}`, {
      method: 'DELETE',
    });
  }

  async archiveInterview(id: string) {
    return this.request(`/interviews/${id}/archive`, {
      method: 'POST',
    });
  }

  async unarchiveInterview(id: string) {
    return this.request(`/interviews/${id}/unarchive`, {
      method: 'POST',
    });
  }

  async addInterviewTimelineEntry(
    id: string,
    data: {
      comment: string;
      statusChange?: string;
      attachmentFile?: File;
    }
  ) {
    let attachmentData = {};

    // If there's a file, upload it first
    if (data.attachmentFile) {
      try {
        const uploadResult = await this.uploadDocument(data.attachmentFile);
        attachmentData = {
          attachmentName: data.attachmentFile.name,
          attachmentUrl: uploadResult.downloadUrl,
          attachmentType: data.attachmentFile.type,
        };
      } catch (error) {
        console.error('Failed to upload attachment:', error);
        throw new Error('Failed to upload attachment file');
      }
    }

    return this.request(`/interviews/${id}/timeline`, {
      method: 'POST',
      body: JSON.stringify({
        comment: data.comment,
        statusChange: data.statusChange,
        ...attachmentData,
      }),
    });
  }

  async getInterviewStats() {
    return this.request('/interviews/stats');
  }

  async createInterviewReminder(interviewId: string, title: string, dueAt: string) {
    return this.request(`/interviews/${interviewId}/reminders`, {
      method: 'POST',
      body: JSON.stringify({ title, dueAt }),
    });
  }

  async getInterviewReminders(interviewId: string) {
    return this.request(`/interviews/${interviewId}/reminders`);
  }

  async completeInterviewReminder(reminderId: string, completed: boolean = true) {
    return this.request(`/interviews/reminders/${reminderId}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  async deleteInterviewReminder(reminderId: string) {
    return this.request(`/interviews/reminders/${reminderId}`, {
      method: 'DELETE',
    });
  }

  async createInterviewTemplate(data: any) {
    return this.request('/interviews/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviewTemplates() {
    return this.request('/interviews/templates');
  }

  async getInterviewTemplate(templateId: string) {
    return this.request(`/interviews/templates/${templateId}`);
  }

  async updateInterviewTemplate(templateId: string, data: any) {
    return this.request(`/interviews/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInterviewTemplate(templateId: string) {
    return this.request(`/interviews/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  // Company Enrichment
  async enrichCompany(companyName: string) {
    return this.request('/companies/enrich', {
      method: 'POST',
      body: JSON.stringify({ companyName }),
    });
  }

  async queueCompanyEnrichment(companyName: string) {
    return this.request('/companies/enrich/queue', {
      method: 'POST',
      body: JSON.stringify({ companyName }),
    });
  }

  async getEnrichmentJobStatus(jobId: string) {
    return this.request(`/companies/enrich/status/${jobId}`);
  }

  async getCompanyInfo(companyName: string) {
    return this.request(`/companies/${encodeURIComponent(companyName)}`);
  }

  async getAllCompanies() {
    return this.request('/companies');
  }

  // Position Fit Scoring
  async queuePositionScoring(data: {
    interviewId: string;
    company: string;
    position: string;
    jobUrl?: string;
    jobDescription?: string;
  }) {
    return this.request('/companies/positions/score/queue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getScoringJobStatus(jobId: string) {
    return this.request(`/companies/positions/score/status/${jobId}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
