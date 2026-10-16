import { Router, Request, Response } from 'express';
import { db, VALID_MODULE_TRANSITIONS, VALID_BUG_TRANSITIONS } from './db.js';
import { BugSeverity, BugPriority, BugStatus, RootCauseCategory, ReviewStatus } from '../types/index.js';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'ReworkGuard API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Users
apiRouter.get('/users', (req: Request, res: Response) => {
  const users = db.getUsers();
  res.json({ success: true, data: users });
});

// Dashboard Stats
apiRouter.get('/dashboard/stats', (req: Request, res: Response) => {
  try {
    const stats = db.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch dashboard metrics' });
  }
});

// GET /api/dashboard/summary
apiRouter.get('/dashboard/summary', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = db.getDashboardSummary({
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch dashboard summary' });
  }
});

// GET /api/dashboard/root-causes
apiRouter.get('/dashboard/root-causes', (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const rootCauses = db.getDashboardRootCauses({
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data: rootCauses });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch root causes distribution' });
  }
});

// GET /api/dashboard/monthly-costs
apiRouter.get('/dashboard/monthly-costs', (req: Request, res: Response) => {
  try {
    const monthlyCosts = db.getDashboardMonthlyCosts();
    res.json({ success: true, data: monthlyCosts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch monthly rework costs' });
  }
});

// Modules
apiRouter.get('/modules', (req: Request, res: Response) => {
  try {
    const modules = db.getModules();
    res.json({ success: true, data: modules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch modules' });
  }
});

apiRouter.get('/modules/:id', (req: Request, res: Response) => {
  const mod = db.getModule(req.params.id as string);
  if (!mod) {
    return res.status(404).json({ success: false, error: 'Module not found' });
  }
  res.json({ success: true, data: mod });
});

apiRouter.post('/modules', (req: Request, res: Response) => {
  const { name, code, version, description, owner_id, total_lines_of_code, status } = req.body;

  // Server-side validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Module name is required' });
  }
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Module version is required (e.g. v1.0.0)' });
  }
  if (!owner_id) {
    return res.status(400).json({ success: false, error: 'Module owner is required' });
  }

  const owner = db.getUser(owner_id);
  if (!owner) {
    return res.status(400).json({ success: false, error: 'Owner must be a valid user' });
  }

  // Derive code if not provided
  const moduleCode = code && typeof code === 'string' && code.trim().length > 0
    ? code.trim().toUpperCase()
    : name.trim().split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 6) || 'MOD';

  try {
    const newMod = db.createModule({
      name: name.trim(),
      code: moduleCode,
      version: version.trim(),
      description: description ? description.trim() : '',
      owner_id,
      total_lines_of_code: Number(total_lines_of_code) || 10000,
      status: status || 'assigned',
    });
    res.status(201).json({ success: true, data: newMod });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create module' });
  }
});

apiRouter.patch('/modules/:id', (req: Request, res: Response) => {
  const moduleId = req.params.id as string;
  const existingModule = db.getModule(moduleId);
  if (!existingModule) {
    return res.status(404).json({ success: false, error: 'Module not found' });
  }

  const requestingUserId = req.body.user_id || (req.headers['x-user-id'] as string) || 'usr-1';
  const requestingUser = db.getUser(requestingUserId);

  // Authorization check: Developers can modify only modules they are authorized to manage; managers can review all modules
  if (requestingUser && requestingUser.role === 'developer' && existingModule.owner_id !== requestingUser.id) {
    return res.status(403).json({
      success: false,
      error: `Unauthorized: Developer ${requestingUser.name} is not authorized to modify "${existingModule.name}". Developers can modify only modules they own.`,
    });
  }

  // Validate owner if being updated
  if (req.body.owner_id) {
    const owner = db.getUser(req.body.owner_id);
    if (!owner) {
      return res.status(400).json({ success: false, error: 'Owner must be a valid user' });
    }
  }

  // Validate status transition
  if (req.body.status && req.body.status !== existingModule.status) {
    const allowedTransitions = VALID_MODULE_TRANSITIONS[existingModule.status] || [];
    if (!allowedTransitions.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from "${existingModule.status}" to "${req.body.status}". Allowed transitions are: ${allowedTransitions.join(', ') || 'None'}.`,
      });
    }
  }

  const mod = db.updateModule(moduleId, req.body, requestingUserId);
  res.json({ success: true, data: mod });
});

// Bugs
apiRouter.get('/bugs', (req: Request, res: Response) => {
  try {
    const { module_id, status, severity, root_cause, assigned_to_id } = req.query;
    const bugs = db.getBugs({
      module_id: module_id as string,
      status: status as string,
      severity: severity as string,
      root_cause: root_cause as string,
      assigned_to_id: assigned_to_id as string,
    });
    res.json({ success: true, data: bugs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch bugs' });
  }
});

apiRouter.get('/bugs/:id', (req: Request, res: Response) => {
  const bug = db.getBug(req.params.id as string);
  if (!bug) {
    return res.status(404).json({ success: false, error: 'Bug not found' });
  }
  res.json({ success: true, data: bug });
});

apiRouter.post('/bugs', (req: Request, res: Response) => {
  const { 
    title, 
    description, 
    module_id, 
    severity, 
    priority, 
    root_cause, 
    assigned_to_id, 
    reproduction_steps,
    status 
  } = req.body;

  // Server-side validation
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Bug description is required' });
  }
  if (!module_id) {
    return res.status(400).json({ success: false, error: 'Module selection is required' });
  }

  // Automatic linking: Retrieve actual module, version, and original owner
  const targetModule = db.getModule(module_id);
  if (!targetModule) {
    return res.status(400).json({ success: false, error: 'Linked module does not exist. Please select a valid module.' });
  }

  if (!assigned_to_id) {
    return res.status(400).json({ success: false, error: 'Assigned Developer is required' });
  }

  const assignedDev = db.getUser(assigned_to_id);
  if (!assignedDev) {
    return res.status(400).json({ success: false, error: 'Assigned Developer must be a valid user' });
  }

  // Normalize severity (Minor, Major, Critical)
  const normalizedSeverity = (severity || 'major').toLowerCase();
  const validSeverities = ['minor', 'major', 'critical', 'low', 'medium', 'high'];
  if (!validSeverities.includes(normalizedSeverity)) {
    return res.status(400).json({ success: false, error: 'Severity must be Minor, Major, or Critical' });
  }

  // Title fallback
  const bugTitle = title && typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : description.trim().split('\n')[0].slice(0, 80);

  try {
    const newBug = db.createBug({
      title: bugTitle,
      description: description.trim(),
      module_id: targetModule.id,
      reproduction_steps: reproduction_steps ? reproduction_steps.trim() : '',
      severity: normalizedSeverity as BugSeverity,
      priority: (priority as BugPriority) || 'p1',
      status: (status as BugStatus) || 'open',
      root_cause: (root_cause as RootCauseCategory) || 'code_defect',
      original_author_id: targetModule.owner_id,
      assigned_to_id: assignedDev.id,
      hourly_rate: assignedDev.hourly_rate || 500.0,
    });
    res.status(201).json({ success: true, data: newBug });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create bug' });
  }
});

apiRouter.patch('/bugs/:id', (req: Request, res: Response) => {
  const bugId = req.params.id as string;
  const existingBug = db.getBug(bugId);
  if (!existingBug) {
    return res.status(404).json({ success: false, error: 'Bug not found' });
  }

  const requestingUserId = req.body.user_id || (req.headers['x-user-id'] as string) || 'usr-1';
  const requestingUser = db.getUser(requestingUserId);

  // Status transition validation
  if (req.body.status && req.body.status !== existingBug.status) {
    const currentStatus = existingBug.status.toLowerCase();
    const newStatus = req.body.status.toLowerCase();

    const allowed = VALID_BUG_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from "${currentStatus}" to "${newStatus}". Allowed transitions are: ${allowed.join(', ') || 'None'}.`,
      });
    }

    // Role check for reopening: "Allow authorized QA users to reopen a bug if the fix fails verification"
    if (newStatus === 'reopened') {
      if (requestingUser && requestingUser.role !== 'qa' && requestingUser.role !== 'manager' && requestingUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: `Unauthorized: Only authorized QA engineers or managers can reopen a bug after verification fails. (${requestingUser.name} has role "${requestingUser.role}").`,
        });
      }
    }
  }

  const updatedBug = db.updateBug(bugId, req.body, requestingUserId);
  res.json({ success: true, data: updatedBug });
});

// Time Entries & Corrective Hours Logging
apiRouter.get('/bugs/:id/time-entries', (req: Request, res: Response) => {
  const entries = db.getTimeEntries(req.params.id as string);
  res.json({ success: true, data: entries });
});

apiRouter.post('/bugs/:id/time-entries', (req: Request, res: Response) => {
  const { hours_spent, work_description, user_id, target_developer_id, date } = req.body;
  const bug_id = req.params.id as string;

  // Validation: Negative, zero or invalid hours are rejected
  const hours = Number(hours_spent);
  if (isNaN(hours) || hours <= 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid hours: Corrective maintenance hours must be a positive number greater than zero.' 
    });
  }

  if (!work_description || typeof work_description !== 'string' || work_description.trim().length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Work description explaining the corrective maintenance action is required.' 
    });
  }

  // Session developer identity
  const sessionUserId = user_id || (req.headers['x-user-id'] as string);
  if (!sessionUserId) {
    return res.status(401).json({ success: false, error: 'Authentication required to log corrective maintenance time.' });
  }

  const sessionUser = db.getUser(sessionUserId);
  if (!sessionUser) {
    return res.status(401).json({ success: false, error: 'Authenticated developer identity not found.' });
  }

  // Authorization check: "Unauthorized users cannot log work on another developer's behalf."
  if (target_developer_id && target_developer_id !== sessionUserId) {
    if (sessionUser.role !== 'manager' && sessionUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: You cannot log corrective maintenance work on another developer's behalf.`,
      });
    }
  }

  const bug = db.getBug(bug_id);
  if (!bug) {
    return res.status(404).json({ success: false, error: 'Target bug does not exist.' });
  }

  try {
    const entry = db.addTimeEntry({
      bug_id,
      user_id: sessionUserId,
      hours_spent: hours,
      work_description: work_description.trim(),
      date,
    });
    res.status(201).json({ success: true, data: entry });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to log corrective time' });
  }
});

// Manager Reviews & Sign-offs
apiRouter.get('/reviews', (req: Request, res: Response) => {
  try {
    const reviews = db.getReviews();
    res.json({ success: true, data: reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/pending — bugs awaiting manager review
apiRouter.get('/reviews/pending', (req: Request, res: Response) => {
  try {
    const pendingBugs = db.getPendingReviews();
    res.json({ success: true, data: pendingBugs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch pending reviews' });
  }
});

// GET /api/bugs/:id/reviews — review history for a specific bug
apiRouter.get('/bugs/:id/reviews', (req: Request, res: Response) => {
  try {
    const reviews = db.getBugReviews(req.params.id as string);
    res.json({ success: true, data: reviews });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch bug reviews' });
  }
});

// POST /api/bugs/:id/review — submit managerial review decision
apiRouter.post('/bugs/:id/review', (req: Request, res: Response) => {
  const bugId = req.params.id as string;
  const bug = db.getBug(bugId);
  if (!bug) {
    return res.status(404).json({ success: false, error: 'Target bug not found for review' });
  }

  // Server-side role authorization check
  const managerId = req.body.manager_id || (req.headers['x-user-id'] as string) || '';
  const manager = db.getUser(managerId);
  if (!manager || (manager.role !== 'manager' && manager.role !== 'admin')) {
    return res.status(403).json({
      success: false,
      error: `Unauthorized: Only authorized managers can submit review decisions. (${manager ? manager.name + ' has role "' + manager.role + '"' : 'User identity missing'}).`,
    });
  }

  const { root_cause, decision, comments, explanation } = req.body;
  const normalizedDecision = decision === 'approved' ? 'approved_for_accounting' : decision;

  const validDecisions = ['pending', 'approved_for_accounting', 'waived', 'disputed'];
  if (!normalizedDecision || !validDecisions.includes(normalizedDecision)) {
    return res.status(400).json({
      success: false,
      error: `Invalid decision. Allowed decisions are: ${validDecisions.join(', ')}`,
    });
  }

  const validRootCauses = [
    'code_defect',
    'requirement_change',
    'external_dependency',
    'unclear_specification',
    'other',
    'logic_error',
    'requirement_gap',
    'regression',
    'integration',
    'edge_case',
    'security',
    'performance',
  ];
  if (!root_cause || !validRootCauses.includes(root_cause)) {
    return res.status(400).json({
      success: false,
      error: 'Root cause must be Code Defect, Requirement Change, External Dependency, Unclear Specification, or Other',
    });
  }

  // Required explanation for waiver or dispute
  const commentText = (comments || explanation || '').trim();
  if ((normalizedDecision === 'waived' || normalizedDecision === 'disputed') && commentText.length === 0) {
    return res.status(400).json({
      success: false,
      error: `A detailed explanation is required when selecting "${normalizedDecision === 'waived' ? 'Waived' : 'Disputed'}".`,
    });
  }

  try {
    const result = db.recordBugReview({
      bug_id: bugId,
      manager_id: manager.id,
      root_cause,
      decision: normalizedDecision,
      comments: commentText,
      explanation: commentText,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to submit review decision' });
  }
});

apiRouter.post('/reviews', (req: Request, res: Response) => {
  const { 
    bug_id, 
    manager_id, 
    developer_id, 
    status, 
    review_notes, 
    cost_accepted, 
    hours_approved, 
    quality_rating 
  } = req.body;

  if (!bug_id) {
    return res.status(400).json({ success: false, error: 'Bug ID is required for review' });
  }
  if (!status || !['approved', 'approved_for_accounting', 'waived', 'disputed', 'rejected', 'changes_requested'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Review decision must be approved, waived, disputed, rejected, or changes_requested' });
  }
  if (!review_notes || review_notes.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Manager review notes and feedback are required' });
  }

  try {
    const newReview = db.createReview({
      bug_id,
      manager_id: manager_id || 'usr-1',
      developer_id: developer_id || 'usr-2',
      status: status as any,
      review_notes: review_notes.trim(),
      cost_accepted: Boolean(cost_accepted),
      hours_approved: Number(hours_approved) || 0,
      quality_rating: Number(quality_rating) || 4,
    });
    res.status(201).json({ success: true, data: newReview });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to create review' });
  }
});

apiRouter.patch('/reviews/:id', (req: Request, res: Response) => {
  const review = db.updateReview(req.params.id as string, req.body, req.body.manager_id || 'usr-1');
  if (!review) {
    return res.status(404).json({ success: false, error: 'Review not found' });
  }
  res.json({ success: true, data: review });
});

// Audit Logs
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 30;
    const logs = db.getAuditLogs(limit);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch audit logs' });
  }
});
