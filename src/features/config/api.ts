import { get, post, put } from '@/shared/api/http';
import type { ConfigDraft, PublishTransitTablePayload, RunSchedule, RunSchedulePayload, SystemSettings, TransitTable } from './types';

export const configApi = {
  settings: () => get<SystemSettings>('/settings'),
  saveSettings: (s: SystemSettings) => put<SystemSettings>('/settings', s),
  save: async (d: ConfigDraft) => { await configApi.saveSettings(d.settings); },
};

export const transitApi = {
  current: () => get<TransitTable>('/transit-tables/current'),
  /** The backend returns a plain array here, not a paged envelope, so this is get not getAll. */
  history: () => get<TransitTable[]>('/transit-tables/history'),
  /** Publishing closes the current version and opens the next one; it never edits in place. */
  publish: (payload: PublishTransitTablePayload) => post<TransitTable>('/transit-tables', payload),
};

export const runScheduleApi = {
  /** Current preparation, buffer and dispatch-slot configuration. */
  current: () => get<RunSchedule>('/eta/schedule'),
  /** Allocation is real-time; only the downstream warehouse timing is configurable. */
  publish: (payload: RunSchedulePayload) =>
    put<unknown>('/business-configurations/eta.schedule', { value: payload }),
};
