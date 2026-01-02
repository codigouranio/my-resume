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
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    // If 401 and we have a refresh token, try to refresh
    if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/')) {
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
      const error = await response.json().catch(() => ({ message: response.statusText }));
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
  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
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

  // Users
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async updateCurrentUser(data: { firstName?: string; lastName?: string; customDomain?: string | null }) {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async checkSubdomainAvailability(subdomain: string) {
    return this.request(`/users/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`);
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

  async updateResume(id: string, data: Partial<{
    slug: string;
    title: string;
    content: string;
    llmContext?: string;
    isPublic?: boolean;
    isPublished?: boolean;
    theme?: string;
  }>) {
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
  async createCheckoutSession(priceId: string) {
    return this.request('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
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
}

export const apiClient = new ApiClient(API_BASE_URL);
