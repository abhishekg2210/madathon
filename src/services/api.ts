import { 
  User, 
  Module, 
  Bug, 
  TimeEntry, 
  Review, 
  AuditLog, 
  DashboardStats,
  DashboardSummary,
  RootCauseDistributionItem,
  MonthlyReworkCostItem,
  ApiResponse 
} from '../../types/index';

const API_BASE = '/api';

// Helper to handle API requests with json parsing & error handling
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data: ApiResponse<T> = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data.data;
  } catch (error: any) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Health
  checkHealth: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    return request<User[]>('/users');
  },

  // Dashboard Summary (4 summary cards + recent bugs table)
  getDashboardSummary: async (filters?: { startDate?: string; endDate?: string }): Promise<DashboardSummary> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<DashboardSummary>(`/dashboard/summary${queryString}`);
  },

  // Dashboard Root Causes Distribution
  getDashboardRootCauses: async (filters?: { startDate?: string; endDate?: string }): Promise<RootCauseDistributionItem[]> => {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<RootCauseDistributionItem[]>(`/dashboard/root-causes${queryString}`);
  },

  // Dashboard Monthly Rework Costs
  getDashboardMonthlyCosts: async (): Promise<MonthlyReworkCostItem[]> => {
    return request<MonthlyReworkCostItem[]>('/dashboard/monthly-costs');
  },

  // Dashboard Stats (legacy/extended)
  getDashboardStats: async (): Promise<DashboardStats> => {
    return request<DashboardStats>('/dashboard/stats');
  },

  // Modules
  getModules: async (): Promise<Module[]> => {
    return request<Module[]>('/modules');
  },

  getModule: async (id: string): Promise<Module> => {
    return request<Module>(`/modules/${id}`);
  },

  createModule: async (moduleData: {
    name: string;
    version: string;
    owner_id: string;
    description?: string;
    code?: string;
    status?: string;
    total_lines_of_code?: number;
  }): Promise<Module> => {
    return request<Module>('/modules', {
      method: 'POST',
      body: JSON.stringify(moduleData),
    });
  },

  updateModule: async (
    id: string, 
    moduleData: Partial<Module> & { user_id?: string; status_notes?: string }
  ): Promise<Module> => {
    return request<Module>(`/modules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(moduleData),
    });
  },

  // Bugs
  getBugs: async (filters?: {
    module_id?: string;
    status?: string;
    severity?: string;
    root_cause?: string;
    assigned_to_id?: string;
  }): Promise<Bug[]> => {
    const query = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val && val !== 'all') query.append(key, val);
      });
    }
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<Bug[]>(`/bugs${queryString}`);
  },

  getBug: async (id: string): Promise<Bug> => {
    return request<Bug>(`/bugs/${id}`);
  },

  createBug: async (bugData: {
    title?: string;
    description: string;
    module_id: string;
    severity: string;
    priority?: string;
    root_cause?: string;
    assigned_to_id: string;
    reproduction_steps?: string;
    status?: string;
  }): Promise<Bug> => {
    return request<Bug>('/bugs', {
      method: 'POST',
      body: JSON.stringify(bugData),
    });
  },

  updateBug: async (
    id: string, 
    bugData: Partial<Bug> & { user_id?: string; status_notes?: string }
  ): Promise<Bug> => {
    return request<Bug>(`/bugs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(bugData),
    });
  },

  // Time Entries & Corrective Rework Hours
  getTimeEntries: async (bugId: string): Promise<TimeEntry[]> => {
    return request<TimeEntry[]>(`/bugs/${bugId}/time-entries`);
  },

  logTimeEntry: async (
    bugId: string,
    entryData: {
      hours_spent: number;
      work_description: string;
      user_id: string;
      target_developer_id?: string;
      date?: string;
    }
  ): Promise<TimeEntry> => {
    return request<TimeEntry>(`/bugs/${bugId}/time-entries`, {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  },

  // Reviews
  getReviews: async (): Promise<Review[]> => {
    return request<Review[]>('/reviews');
  },

  getPendingReviews: async (): Promise<Bug[]> => {
    return request<Bug[]>('/reviews/pending');
  },

  getBugReviews: async (bugId: string): Promise<Review[]> => {
    return request<Review[]>(`/bugs/${bugId}/reviews`);
  },

  submitBugReview: async (
    bugId: string,
    reviewData: {
      manager_id: string;
      root_cause: string;
      decision: string;
      comments?: string;
      explanation?: string;
    }
  ): Promise<{ review: Review; bug: Bug }> => {
    return request<{ review: Review; bug: Bug }>(`/bugs/${bugId}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },

  createReview: async (reviewData: {
    bug_id: string;
    manager_id: string;
    developer_id: string;
    status: 'approved' | 'rejected' | 'changes_requested';
    review_notes: string;
    cost_accepted: boolean;
    hours_approved: number;
    quality_rating: number;
  }): Promise<Review> => {
    return request<Review>('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  },

  updateReview: async (id: string, reviewData: Partial<Review>): Promise<Review> => {
    return request<Review>(`/reviews/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(reviewData),
    });
  },

  // Audit Logs
  getAuditLogs: async (limit?: number): Promise<AuditLog[]> => {
    const query = limit ? `?limit=${limit}` : '';
    return request<AuditLog[]>(`/audit-logs${query}`);
  },
};
