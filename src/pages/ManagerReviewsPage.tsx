import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Review, Bug, User, RootCauseCategory, ReviewDecision } from '../../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { FormField, Input, Textarea, Select } from '../components/common/FormControls';
import { StatusBadge } from '../components/common/StatusBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { RootCauseBadge } from '../components/common/RootCauseBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorAlert } from '../components/common/ErrorAlert';
import { useToast } from '../components/common/Toast';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  Check, 
  RotateCcw,
  UserCheck,
  FileText,
  Search,
  Filter,
  History,
  Info,
  Layers,
  Scale,
  AlertCircle
} from 'lucide-react';

// INR Currency Formatter
export const formatINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val || 0);
};

export const ManagerReviewsPage: React.FC = () => {
  const { currentUser, users, refreshReviewCount } = useApp();
  const { addToast } = useToast();

  const [pendingBugs, setPendingBugs] = useState<Bug[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab: Awaiting Review vs Full Review History
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Review Form Modal State
  const [selectedBugForReview, setSelectedBugForReview] = useState<Bug | null>(null);
  const [reviewRootCause, setReviewRootCause] = useState<RootCauseCategory>('code_defect');
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>('approved_for_accounting');
  const [reviewExplanation, setReviewExplanation] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFormError, setReviewFormError] = useState<string | null>(null);

  // Individual Bug History Modal State
  const [historyModalBug, setHistoryModalBug] = useState<Bug | null>(null);
  const [bugReviewHistory, setBugReviewHistory] = useState<Review[]>([]);
  const [loadingBugHistory, setLoadingBugHistory] = useState(false);

  // Authorization check: Only authorized managers can submit reviews
  const isAuthorizedManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingData, reviewsData] = await Promise.all([
        api.getPendingReviews(),
        api.getReviews(),
      ]);
      setPendingBugs(pendingData);
      setAllReviews(reviewsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load manager reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Open Review Form for a Bug
  const handleOpenReviewModal = (bug: Bug) => {
    setSelectedBugForReview(bug);
    setReviewFormError(null);

    // Initialize root cause from bug or default to code defect
    const initialCause = (bug.root_cause as RootCauseCategory) || 'code_defect';
    setReviewRootCause(initialCause);

    // Default decision based on current status
    if (bug.review_status === 'waived') {
      setReviewDecision('waived');
    } else if (bug.review_status === 'disputed') {
      setReviewDecision('disputed');
    } else {
      setReviewDecision('approved_for_accounting');
    }

    setReviewExplanation('');
  };

  // Open Bug Review History Modal
  const handleOpenBugHistory = async (bug: Bug) => {
    setHistoryModalBug(bug);
    setLoadingBugHistory(true);
    try {
      const history = await api.getBugReviews(bug.id);
      setBugReviewHistory(history);
    } catch {
      setBugReviewHistory([]);
    } finally {
      setLoadingBugHistory(false);
    }
  };

  // Submit Manager Review Decision
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBugForReview) return;
    setReviewFormError(null);

    // Role check
    if (!isAuthorizedManager) {
      setReviewFormError('Unauthorized: Only authorized managers can submit review decisions. Please switch persona to a manager.');
      return;
    }

    // Required explanation for waiver or dispute
    if ((reviewDecision === 'waived' || reviewDecision === 'disputed') && !reviewExplanation.trim()) {
      setReviewFormError(`A detailed explanation is required when selecting "${reviewDecision === 'waived' ? 'Waived' : 'Disputed'}".`);
      return;
    }

    setIsSubmittingReview(true);
    try {
      await api.submitBugReview(selectedBugForReview.id, {
        manager_id: currentUser?.id || 'usr-1',
        root_cause: reviewRootCause,
        decision: reviewDecision,
        comments: reviewExplanation.trim(),
        explanation: reviewExplanation.trim(),
      });

      addToast({
        type: reviewDecision === 'approved_for_accounting' ? 'success' : reviewDecision === 'waived' ? 'info' : 'warning',
        title: 'Review Decision Recorded',
        message: `${selectedBugForReview.id} marked as "${reviewDecision.replace(/_/g, ' ').toUpperCase()}".`,
      });

      setSelectedBugForReview(null);
      await refreshReviewCount();
      await fetchData();
    } catch (err: any) {
      setReviewFormError(err.message || 'Failed to submit review decision.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Filtered bugs awaiting review
  const filteredPendingBugs = pendingBugs.filter((b) => {
    const matchesSearch =
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.title && b.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.module_name && b.module_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.original_module_owner_name && b.original_module_owner_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.assigned_to_name && b.assigned_to_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ||
      b.review_status === statusFilter ||
      b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtered reviews for history tab
  const filteredHistory = allReviews.filter((r) => {
    return (
      r.bug_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.bug_title && r.bug_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.manager_name && r.manager_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.comments && r.comments.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  // Tally metrics
  const totalReworkPending = filteredPendingBugs.reduce((sum, b) => sum + (b.rework_cost || 0), 0);
  const totalHoursPending = filteredPendingBugs.reduce((sum, b) => sum + (b.corrective_hours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Manager Review & Accountability Ledger</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Review bug root causes, verify corrective maintenance hours, record fair managerial decisions, and maintain audit trails.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-lg border border-zinc-200 text-xs">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-zinc-950 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Awaiting Review ({pendingBugs.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-zinc-950 text-white font-semibold shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Review History & Audit ({allReviews.length})
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Fairness & Governance Banner */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col sm:flex-row items-start gap-3.5 text-xs text-zinc-600">
        <Scale className="w-5 h-5 text-zinc-800 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-zinc-900 flex items-center gap-2">
            Fairness, Liability & Statutory Compliance Notice
          </div>
          <p className="text-zinc-600 leading-relaxed">
            • <strong>Module Provenance:</strong> Original module ownership alone does not prove fault. Root causes must be evaluated objectively.<br />
            • <strong>Non-chargeable Causes:</strong> Requirement changes, specification gaps, and external vendor dependencies can be classified as non-chargeable.<br />
            • <strong>Cost Integrity:</strong> A waiver excused from accounting does <em>not</em> erase the underlying recorded rework hours or engineering cost.<br />
            • <strong>Payroll Separation:</strong> ReworkGuard does <strong>not</strong> automatically deduct employee salaries. Any payroll adjustments strictly require independent lawful HR authorization.
          </p>
        </div>
      </div>

      {/* Role authorization warning if non-manager is active */}
      {!isAuthorizedManager && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              You are currently viewing as <strong>{currentUser?.name || 'Developer'}</strong> ({currentUser?.role}). 
              Review decision submissions require authorized Manager credentials.
            </span>
          </div>
          <span className="text-[11px] font-medium text-amber-700 underline">
            Switch persona to Sarah Connor (Manager) in top bar
          </span>
        </div>
      )}

      {/* Filters Strip */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <Input
              placeholder={activeTab === 'pending' ? "Search bug ID, description, owner, fixer..." : "Search reviewer, bug ID, reason..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {activeTab === 'pending' && (
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs"
            >
              <option value="all">All Review Statuses</option>
              <option value="pending">Pending</option>
              <option value="disputed">Disputed</option>
              <option value="not_submitted">Not Submitted</option>
              <option value="fixed">Fixed</option>
            </Select>
          )}
        </div>

        {activeTab === 'pending' && (
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-500">
            <span>
              Showing <strong>{filteredPendingBugs.length}</strong> of <strong>{pendingBugs.length}</strong> defects awaiting managerial review
            </span>
            <div className="flex items-center gap-4">
              <span>Awaiting Rework Hours: <strong className="text-zinc-950 font-mono">{totalHoursPending.toFixed(1)} hrs</strong></span>
              <span>Awaiting Rework Cost: <strong className="text-zinc-950 font-mono">{formatINR(totalReworkPending)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingSpinner message="Loading review queue, root cause logs, and audit entries..." />
      ) : activeTab === 'pending' ? (
        /* ========================================================================= */
        /* TAB 1: BUGS AWAITING REVIEW TABLE (EXACT REQUIRED COLUMNS)               */
        /* Columns: Bug ID, Module, Original Owner, Fixing Developer, Corrective Hours, Rework Cost, Review Status */
        /* ========================================================================= */
        filteredPendingBugs.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Bugs Awaiting Review"
            description="All reported bug fixes have been reviewed and verified by engineering management."
          />
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Bug ID</th>
                    <th className="py-3 px-3.5">Module</th>
                    <th className="py-3 px-3.5">Original Owner</th>
                    <th className="py-3 px-3.5">Fixing Developer</th>
                    <th className="py-3 px-3.5 text-right">Corrective Hours</th>
                    <th className="py-3 px-3.5 text-right">Rework Cost</th>
                    <th className="py-3 px-3.5">Review Status</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredPendingBugs.map((bug) => (
                    <tr key={bug.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* 1. Bug ID */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-zinc-950">
                        {bug.id}
                      </td>

                      {/* 2. Module */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-zinc-900">{bug.module_name || bug.module_code}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {bug.module_version || 'v1.0.0'} ({bug.module_code})
                        </div>
                      </td>

                      {/* 3. Original Owner */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-medium text-zinc-900">
                          {bug.original_module_owner_name || bug.original_author_name || 'N/A'}
                        </div>
                        <span className="text-[10px] text-zinc-400">Provenance Owner</span>
                      </td>

                      {/* 4. Fixing Developer */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-medium text-zinc-900">
                          {bug.assigned_to_name || 'Unassigned'}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {formatINR(bug.hourly_rate)}/hr
                        </span>
                      </td>

                      {/* 5. Corrective Hours */}
                      <td className="py-3 px-3.5 text-right font-mono font-medium text-zinc-800 whitespace-nowrap">
                        {bug.corrective_hours} hrs
                      </td>

                      {/* 6. Rework Cost */}
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-zinc-950 whitespace-nowrap">
                        {formatINR(bug.rework_cost)}
                      </td>

                      {/* 7. Review Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={bug.review_status} type="review" />
                      </td>

                      {/* Actions: Review button */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap space-x-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenReviewModal(bug)}
                          className="text-[11px] py-1 px-2.5"
                          leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenBugHistory(bug)}
                          className="text-[11px] py-1 px-2 text-zinc-600"
                        >
                          History
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* ========================================================================= */
        /* TAB 2: REVIEW HISTORY & AUDIT TRAIL                                      */
        /* Displays Reviewer, Decision, Reason, Root Cause, Timestamp               */
        /* ========================================================================= */
        filteredHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="No Review History Found"
            description="There are no recorded review decisions matching your search query."
          />
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Reviewer</th>
                    <th className="py-3 px-3.5">Bug ID & Module</th>
                    <th className="py-3 px-3.5">Decision</th>
                    <th className="py-3 px-3.5">Root Cause</th>
                    <th className="py-3 px-3.5">Reason / Explanation</th>
                    <th className="py-3 px-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredHistory.map((rev) => (
                    <tr key={rev.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Reviewer */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-zinc-950 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-zinc-600" />
                          {rev.manager_name || 'Manager'}
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">Review ID: {rev.id}</span>
                      </td>

                      {/* Bug ID & Module */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-zinc-900">{rev.bug_id}</div>
                        <div className="text-[11px] text-zinc-500">{rev.module_name || 'Module'}</div>
                      </td>

                      {/* Decision */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={rev.decision || rev.status} type="review" />
                      </td>

                      {/* Root Cause */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <RootCauseBadge cause={rev.root_cause || 'code_defect'} />
                      </td>

                      {/* Reason / Explanation */}
                      <td className="py-3 px-3.5 text-zinc-700 max-w-sm leading-relaxed">
                        {rev.comments || rev.explanation || rev.review_notes || (
                          <span className="text-zinc-400 italic">No notes recorded</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3.5 text-right font-mono text-zinc-500 whitespace-nowrap">
                        {new Date(rev.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modal: Review Form */}
      {selectedBugForReview && (
        <Modal
          isOpen={!!selectedBugForReview}
          onClose={() => setSelectedBugForReview(null)}
          title={`Review Defect: ${selectedBugForReview.id}`}
          subtitle="Record root cause analysis and managerial accounting decision"
          maxWidth="xl"
        >
          <form onSubmit={handleSubmitReview} className="space-y-4">
            {reviewFormError && <ErrorAlert message={reviewFormError} />}

            {/* Bug Metadata Card */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
                <div>
                  <span className="font-bold text-zinc-950 text-sm">
                    {selectedBugForReview.title || selectedBugForReview.id}
                  </span>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Module: <strong>{selectedBugForReview.module_name || selectedBugForReview.module_code}</strong> ({selectedBugForReview.module_version || 'v1.0.0'})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selectedBugForReview.severity} />
                  <StatusBadge status={selectedBugForReview.review_status} type="review" />
                </div>
              </div>

              {/* Separation of Owner vs Fixer & Financial Impact */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-zinc-400 block font-medium">Original Owner</span>
                  <strong className="text-zinc-900">{selectedBugForReview.original_module_owner_name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Fixing Developer</span>
                  <strong className="text-zinc-900">{selectedBugForReview.assigned_to_name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Corrective Hours</span>
                  <strong className="text-zinc-950 font-mono">{selectedBugForReview.corrective_hours} hrs</strong>
                </div>
                <div>
                  <span className="text-zinc-400 block font-medium">Rework Cost</span>
                  <strong className="text-zinc-950 font-mono">{formatINR(selectedBugForReview.rework_cost)}</strong>
                </div>
              </div>

              <div className="text-[11px] text-zinc-600 bg-white p-2.5 rounded border border-zinc-200">
                <span className="font-semibold text-zinc-800 block mb-0.5">Defect Description:</span>
                {selectedBugForReview.description}
              </div>
            </div>

            {/* Root Cause Dropdown */}
            <FormField 
              label="Root Cause Category" 
              required 
              hint="Select the verified technical or business origin of the defect"
            >
              <Select
                value={reviewRootCause}
                onChange={(e) => setReviewRootCause(e.target.value as RootCauseCategory)}
                required
              >
                <option value="code_defect">Code Defect (Internal engineering error or logic omission)</option>
                <option value="requirement_change">Requirement Change (Scope or specification alteration post-handover)</option>
                <option value="external_dependency">External Dependency (Third-party library, API, or infrastructure outage)</option>
                <option value="unclear_specification">Unclear Specification (Ambiguous user story or undocumented edge case)</option>
                <option value="other">Other (Process gap, operational mishap, or unclassified)</option>
              </Select>
            </FormField>

            {/* Non-chargeable callout when appropriate */}
            {(reviewRootCause === 'requirement_change' || reviewRootCause === 'external_dependency' || reviewRootCause === 'unclear_specification') && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Non-Chargeable Classification:</strong> When defects stem from requirement shifts, external vendor failures, or unclear specs, managers typically elect to <em>Waive</em> financial accountability.
                </span>
              </div>
            )}

            {/* Decision Field */}
            <FormField 
              label="Managerial Review Decision" 
              required 
              hint="Determine financial accounting status and corrective maintenance disposition"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  reviewDecision === 'approved_for_accounting' 
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 ring-1 ring-emerald-500' 
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="approved_for_accounting"
                    checked={reviewDecision === 'approved_for_accounting'}
                    onChange={() => setReviewDecision('approved_for_accounting')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-zinc-900">Approved for Accounting</span>
                    <span className="text-[11px] text-zinc-500">Corrective hours accepted; closed and ledgered.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  reviewDecision === 'waived' 
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-500' 
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="waived"
                    checked={reviewDecision === 'waived'}
                    onChange={() => setReviewDecision('waived')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-zinc-900">Waived</span>
                    <span className="text-[11px] text-zinc-500">Charges excused (underlying hours remain recorded).</span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  reviewDecision === 'disputed' 
                    ? 'border-red-500 bg-red-50/50 text-red-950 ring-1 ring-red-500' 
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="disputed"
                    checked={reviewDecision === 'disputed'}
                    onChange={() => setReviewDecision('disputed')}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-zinc-900">Disputed</span>
                    <span className="text-[11px] text-zinc-500">Contested root cause; remains pending further inquiry.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                  reviewDecision === 'pending' 
                    ? 'border-amber-500 bg-amber-50/50 text-amber-950 ring-1 ring-amber-500' 
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="pending"
                    checked={reviewDecision === 'pending'}
                    onChange={() => setReviewDecision('pending')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-zinc-900">Pending</span>
                    <span className="text-[11px] text-zinc-500">Keep in active review queue awaiting verification.</span>
                  </div>
                </label>
              </div>
            </FormField>

            {/* Explanation Field: REQUIRED FOR WAIVER OR DISPUTE */}
            <FormField 
              label={
                reviewDecision === 'waived' || reviewDecision === 'disputed'
                  ? `Required Explanation for ${reviewDecision === 'waived' ? 'Waiver' : 'Dispute'}`
                  : "Review Reason / Comments (Optional)"
              }
              required={reviewDecision === 'waived' || reviewDecision === 'disputed'}
              hint={
                reviewDecision === 'waived' || reviewDecision === 'disputed'
                  ? "A clear justification is legally & managerially required to substantiate this decision."
                  : "Summary of code review, test verification, or retrospective action items."
              }
            >
              <Textarea
                placeholder={
                  reviewDecision === 'waived'
                    ? "Explain why the cost is waived (e.g., Unannounced breaking changes in third-party gateway API v3 caused webhook failures, outside developer control)..."
                    : reviewDecision === 'disputed'
                    ? "Document the specific points of contention or dispute (e.g., Original PR was explicitly approved by architect with known tech-debt trade-off)..."
                    : "Verified code patch and regression tests. Hours approved for project accounting."
                }
                value={reviewExplanation}
                onChange={(e) => setReviewExplanation(e.target.value)}
                rows={3}
                required={reviewDecision === 'waived' || reviewDecision === 'disputed'}
              />
            </FormField>

            {/* Active Reviewer Identity */}
            <div className="bg-zinc-100 p-2.5 rounded-lg flex items-center justify-between text-xs text-zinc-600">
              <span>Reviewing As: <strong className="text-zinc-950">{currentUser?.name || 'Manager'}</strong> ({currentUser?.role})</span>
              <span className="font-mono text-[10px] text-zinc-500">ID: {currentUser?.id || 'usr-1'}</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedBugForReview(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingReview}
                disabled={!isAuthorizedManager}
              >
                Record Review Decision
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Bug Specific Decision History */}
      {historyModalBug && (
        <Modal
          isOpen={!!historyModalBug}
          onClose={() => setHistoryModalBug(null)}
          title={`Review Audit Trail: ${historyModalBug.id}`}
          subtitle={`Chronological decision log for ${historyModalBug.title || historyModalBug.id}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {loadingBugHistory ? (
              <LoadingSpinner message="Loading historical decisions..." />
            ) : bugReviewHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-lg">
                No previous managerial reviews recorded for this bug yet.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {bugReviewHistory.map((item) => (
                  <div key={item.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.decision || item.status} type="review" />
                        <RootCauseBadge cause={item.root_cause || 'code_defect'} />
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-zinc-700 leading-relaxed pt-1">
                      {item.comments || item.explanation || item.review_notes || (
                        <span className="text-zinc-400 italic">No explanation provided</span>
                      )}
                    </div>

                    <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 flex items-center justify-between">
                      <span>Reviewer: <strong className="text-zinc-800">{item.manager_name || 'Manager'}</strong></span>
                      <span className="font-mono">Review ID: {item.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <Button variant="outline" onClick={() => setHistoryModalBug(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
