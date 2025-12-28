const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
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

  // Users
  async getCurrentUser() {
    return this.request('/users/me');
  }

  async updateCurrentUser(data: { firstName?: string; lastName?: string }) {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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

  // Templates
  async getTemplates() {
    return this.request('/templates');
  }

  async getTemplate(id: string) {
    return this.request(`/templates/${id}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
