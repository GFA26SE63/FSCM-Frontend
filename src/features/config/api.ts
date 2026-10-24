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
  /** Milestones come back already resolved to instants, so the portal never re-derives the zone. */
  current: () => get<RunSchedule>('/eta/schedule'),
  /** One document: the cutoff, the deadline and the reminders are validated against each other. */
  publish: (payload: RunSchedulePayload) =>
    put<unknown>('/business-configurations/eta.schedule', { value: payload }),
};
