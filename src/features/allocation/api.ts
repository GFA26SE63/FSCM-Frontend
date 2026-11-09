import { get, post } from '@/shared/api/http';
import type { AllocationRun, AllocationRunSummary, PlanVersion } from './types';

export const allocationApi = {
  issuePicking: (runId: string) => post<unknown[]>(`/allocation-runs/${runId}/picking-lists`),
  list: (filters: { fromDate?: string; toDate?: string }) =>
    get<AllocationRunSummary[]>('/allocation-runs', filters),
  /** Starts today's idempotent run. The selected date is also the 00:00 Vietnam cutoff. */
  start: (v: { cutoffAt: string }) =>
    post<AllocationRun>('/allocation-runs', { cutoffAt: v.cutoffAt }),
  /** One run per Vietnam business date; the date is the natural key an Admin has in hand. */
  runByDate: (businessDate: string) => get<AllocationRun>(`/allocation-runs/by-date/${businessDate}`),
  run: (runId: string) => get<AllocationRun>(`/allocation-runs/${runId}`),
  planVersions: (runId: string) => get<PlanVersion[]>(`/allocation-runs/${runId}/plan-versions`),
  /** Approving covers the allocation and its price together; there is no batch-by-batch editing. */
  approve: (v: { versionId: string; expectedVersion: number }) =>
    post<PlanVersion>(`/allocation-runs/plan-versions/${v.versionId}/approve`, { expectedVersion: v.expectedVersion }),
  requestRecalculation: (v: { versionId: string; expectedVersion: number; reason: string }) =>
    post<PlanVersion>(`/allocation-runs/plan-versions/${v.versionId}/request-recalculation`, {
      expectedVersion: v.expectedVersion,
      reason: v.reason,
    }),
  close: (v: { runId: string; expectedVersion: number; reason?: string }) =>
    post<AllocationRun>(`/allocation-runs/${v.runId}/close`, {
      expectedVersion: v.expectedVersion,
      reason: v.reason || null,
    }),
};
