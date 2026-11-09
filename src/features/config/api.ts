import { get, getAll, post, put } from '@/shared/api/http';
import type { ConfigDraft, PublishTransitTablePayload, RunSchedule, RunSchedulePayload, SystemSettings, TransitTable } from './types';

interface ConfigurationRow { key: string; value: unknown }
const numberValue = (rows: ConfigurationRow[], key: string, fallback: number) => {
  const value = rows.find((row) => row.key === key)?.value;
  return typeof value === 'number' ? value : Number(value ?? fallback);
};

export const configApi = {
  settings: async (): Promise<SystemSettings> => {
    const rows = await getAll<ConfigurationRow>('/configurations');
    const raw = rows.find((row) => row.key === 'allocation.weights')?.value as Partial<Record<'expiry' | 'distance' | 'coverage', number>> | undefined;
    const allocation = { wE: raw?.expiry ?? 0.5, wD: raw?.distance ?? 0.3, wQ: raw?.coverage ?? 0.2 };
    const radiusKm = numberValue(rows, 'allocation.service_radius_meters', 20000) / 1000;
    return {
      allocation,
      dmaxRetailerKm: radiusKm,
      dmaxWarehouseKm: radiusKm,
      rotation: { ...allocation, velocityDays: 30, minQty: 1, roundTo: 1 },
      minRegionalStock: 0,
      batchDiscountTiers: [{ maxRemainingPct: 30, discountPct: 20 }, { maxRemainingPct: 50, discountPct: 10 }],
      loyaltyPointRateVnd: 1000,
    };
  },
  saveSettings: async (s: SystemSettings) => {
    await Promise.all([
      put('/configurations/allocation.weights', { value: { expiry: s.allocation.wE, distance: s.allocation.wD, coverage: s.allocation.wQ } }),
      put('/configurations/allocation.service_radius_meters', { value: Math.round(s.dmaxRetailerKm * 1000) }),
    ]);
    return s;
  },
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
    put<unknown>('/configurations/eta.schedule', { value: payload }),
};
