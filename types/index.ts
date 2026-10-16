// ReworkGuard Shared TypeScript Interfaces

export type UserRole = 'developer' | 'manager' | 'qa' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hourly_rate: number; // e.g. 75 ($/hr)
  avatar?: string;
  created_at: string;
}

export type ModuleStatus = 
  | 'assigned' 
  | 'in_progress' 
  | 'completed' 
  | 'reopened' 
  | 'closed'
  | 'active'
  | 'maintenance'
  | 'deprecated';

export interface ModuleStatusHistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_id: string;
  changed_by_name?: string;
  timestamp: string;
  notes?: string;
}

export interface Module {
  id: string;
  name: string;
  code: string; // e.g. "AUTH", "PAYMENT", "CHECKOUT"
  version: string; // e.g. "v1.0.0", "v2.1.0"
  description: string;
  owner_id: string;
  owner_name?: string;
  total_lines_of_code: number;
  status: ModuleStatus;
  created_at: string;
  updated_at: string;
  completion_date?: string | null;
  status_history?: ModuleStatusHistoryItem[];
  // Computed analytics
  total_bugs?: number;
  open_bugs?: number;
  resolved_bugs?: number;
  rework_hours?: number;
  rework_cost?: number;
  defect_density?: number; // bugs per KLOC
}

export type BugSeverity = 'critical' | 'major' | 'minor' | 'high' | 'medium' | 'low';
export type BugPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type BugStatus = 'open' | 'in_progress' | 'fixed' | 'closed' | 'reopened' | 'review_pending';
export type RootCauseCategory = 
  | 'logic_error' 
  | 'requirement_gap' 
  | 'regression' 
  | 'integration' 
  | 'edge_case' 
  | 'security' 
  | 'performance'
  | 'code_defect'
  | 'requirement_change'
  | 'external_dependency'
  | 'unclear_specification'
  | 'other';

export type ReviewDecision = 'pending' | 'approved_for_accounting' | 'waived' | 'disputed';

export type ReviewStatus = 
  | 'not_submitted' 
  | 'pending' 
  | 'approved_for_accounting'
  | 'approved' 
  | 'waived'
  | 'disputed'
  | 'rejected' 
  | 'changes_requested';

export interface BugStatusHistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_id: string;
  changed_by_name?: string;
  timestamp: string;
  notes?: string;
}

export interface Bug {
  id: string;
  title: string;
  description: string;
  module_id: string;
  module_name?: string;
  module_code?: string;
  module_version?: string;
  original_module_owner_id?: string;
  original_module_owner_name?: string;
  reproduction_steps?: string;
  severity: BugSeverity;
  priority: BugPriority;
  status: BugStatus;
  root_cause: RootCauseCategory;
  original_author_id?: string;
  original_author_name?: string;
  assigned_to_id: string;
  assigned_to_name?: string;
  corrective_hours: number;
  hourly_rate: number;
  rework_cost: number; // corrective_hours * hourly_rate
  review_status: ReviewStatus;
  status_history?: BugStatusHistoryItem[];
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface TimeEntry {
  id: string;
  bug_id: string;
  bug_title?: string;
  user_id: string;
  user_name?: string;
  hours_spent: number;
  hourly_rate: number;
  cost: number;
  work_description: string;
  date: string;
  created_at: string;
}

export interface Review {
  id: string;
  bug_id: string;
  bug_title?: string;
  bug_description?: string;
  bug_severity?: BugSeverity;
  module_name?: string;
  module_code?: string;
  module_owner_name?: string;
  manager_id: string;
  manager_name?: string;
  developer_id?: string;
  developer_name?: string;
  root_cause?: RootCauseCategory | string;
  decision?: ReviewDecision | string;
  status: string; // 'pending' | 'approved_for_accounting' | 'approved' | 'waived' | 'disputed' | 'rejected' | 'changes_requested'
  review_notes?: string;
  comments?: string; // required explanation for waiver or dispute
  explanation?: string;
  cost_accepted?: boolean;
  hours_approved?: number;
  quality_rating?: number; // 1 to 5
  created_at: string;
  updated_at?: string;
}

export interface AuditLog {
  id: string;
  entity_type: 'bug' | 'module' | 'review' | 'time_entry';
  entity_id: string;
  action: string;
  user_id: string;
  user_name?: string;
  details: string;
  timestamp: string;
}

export interface ModuleCostMetric {
  module_id: string;
  module_name: string;
  module_code: string;
  rework_cost: number;
  hours: number;
  bug_count: number;
  defect_density: number;
}

export interface SeverityMetric {
  severity: string;
  count: number;
  cost: number;
}

export interface RootCauseMetric {
  root_cause: string;
  count: number;
  cost: number;
}

export interface MonthlyTrendMetric {
  month: string;
  cost: number;
  hours: number;
  bugs: number;
}

export interface DashboardStats {
  total_bugs: number;
  open_bugs: number;
  in_progress_bugs: number;
  review_pending_bugs: number;
  closed_bugs: number;
  total_corrective_hours: number;
  total_rework_cost: number;
  avg_rework_cost_per_bug: number;
  defect_density_overall: number;
  cost_by_module: ModuleCostMetric[];
  bugs_by_severity: SeverityMetric[];
  bugs_by_root_cause: RootCauseMetric[];
  monthly_trend: MonthlyTrendMetric[];
  recent_activity: AuditLog[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface DashboardSummaryRecentBug {
  id: string;
  title: string;
  module_id: string;
  module_code: string;
  module_name: string;
  severity: BugSeverity;
  status: BugStatus;
  fix_hours: number;
  rework_cost: number;
  created_at: string;
}

export interface DashboardSummary {
  total_modules: number;
  total_bugs: number;
  total_corrective_hours: number;
  total_rework_cost: number;
  reopen_rate: number;
  resolved_bugs_count: number;
  reopened_bugs_count: number;
  manager_waiver_cost: number;
  currency: string;
  recent_bugs: DashboardSummaryRecentBug[];
}

export interface RootCauseDistributionItem {
  category: 'Code Defect' | 'Requirement Change' | 'External Dependency' | 'Other' | string;
  count: number;
  hours: number;
  rework_cost: number;
  percentage: number;
}

export interface MonthlyReworkCostItem {
  month: string;
  rework_cost: number;
  corrective_hours: number;
  bug_count: number;
}

