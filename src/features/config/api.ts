import { get, post, put } from '@/shared/api/http';
import type { ConfigDraft, PublishTransitTablePayload, RunSchedule, RunSchedulePayload, SystemSettings, TransitTable } from './types';

export const configApi = {
  settings: async (): Promise<SystemSettings> => {
    const rows = await get<{ key: string; value: unknown }[]>('/configurations');
    const values = new Map(rows.map((r) => [r.key, r.value]));
    const weights = values.get('allocation.weights') as { expiry: number; distance: number; coverage: number } | undefined;
    if (!weights || !values.has('allocation.service_radius_meters')) throw new Error('Chưa có cấu hình allocation được công bố.');
    return { allocation: { wE: weights.expiry, wD: weights.distance, wQ: weights.coverage },
      dmaxRetailerKm: Number(values.get('allocation.service_radius_meters')) / 1000,
      orderStepCartons: Number(values.get('order.order_step_cartons') ?? 1),
      defaultMlorRatio: Number(values.get('mlor.default_ratio') ?? 0.25) };
  },
  saveSettings: async (s: SystemSettings) => {
    const entries = [
      ['allocation.weights', { expiry: s.allocation.wE, distance: s.allocation.wD, coverage: s.allocation.wQ }],
      ['allocation.service_radius_meters', Math.round(s.dmaxRetailerKm * 1000)],
      ['order.order_step_cartons', s.orderStepCartons], ['mlor.default_ratio', s.defaultMlorRatio],
    ] as const;
    for (const [key, value] of entries) await put(`/configurations/${key}`, { value });
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
  /** Current preparation, buffer and dispatch-slot configuration. */
  current: () => get<RunSchedule>('/eta/schedule'),
  /** Allocation is real-time; only the downstream warehouse timing is configurable. */
  publish: (payload: RunSchedulePayload) =>
    put<unknown>('/configurations/eta.schedule', { value: payload }),
};
