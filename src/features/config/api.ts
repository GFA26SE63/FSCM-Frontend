import { graphql } from '@/shared/api/graphql';
import { post, put } from '@/shared/api/http';
import type { BackgroundJobs, ConfigDraft, PublishTransitTablePayload, RunSchedule, RunSchedulePayload, SystemSettings, TransitTable } from './types';

export const configApi = {
  saveEntries: (entries: { key: string; value: unknown }[]) => put('/configurations/batch', { entries }),
  settings: async (): Promise<SystemSettings> => {
    const { businessConfigurations: rows } = await graphql<{ businessConfigurations: { key: string; value: unknown }[] }>('query { businessConfigurations { key value } }');
    const values = new Map(rows.map((r) => [r.key, r.value]));
    const weights = values.get('allocation.weights') as { expiry: number; distance: number; coverage: number } | undefined;
    if (!weights || !values.has('allocation.service_radius_meters')) throw new Error('Chưa có cấu hình phân bổ được công bố.');
    return { allocation: { wE: weights.expiry, wD: weights.distance, wQ: weights.coverage },
      dmaxRetailerKm: Number(values.get('allocation.service_radius_meters')) / 1000,
      orderStepCartons: Number(values.get('order.order_step_cartons') ?? 1),
      defaultMlorRatio: Number(values.get('mlor.default_ratio') ?? 0.25),
      orderCompletionGraceDays: Number(values.get('order.completion_grace_days') ?? 0),
      payOsLinkLifetimeMinutes: Number(values.get('payment.payos_link_lifetime_minutes') ?? 0),
      demoFastScanEnabled: values.get('demo.fast_scan_enabled') === true };
  },
  saveSettings: async (s: SystemSettings, keys?: readonly string[]) => {
    const entries = [
      ['allocation.weights', { expiry: s.allocation.wE, distance: s.allocation.wD, coverage: s.allocation.wQ }],
      ['allocation.service_radius_meters', Math.round(s.dmaxRetailerKm * 1000)],
      ['order.order_step_cartons', s.orderStepCartons], ['mlor.default_ratio', s.defaultMlorRatio],
      ['order.completion_grace_days', s.orderCompletionGraceDays],
      ['payment.payos_link_lifetime_minutes', s.payOsLinkLifetimeMinutes],
      ['demo.fast_scan_enabled', s.demoFastScanEnabled],
    ] as const;
    await put('/configurations/batch', { entries: entries.filter(([key]) => !keys || keys.includes(key)).map(([key, value]) => ({ key, value })) });
    return s;
  },
  save: async (d: ConfigDraft) => { await configApi.saveSettings(d.settings, d.keys); },
};

const transitFields = `id version maxServingDistanceMeters effectiveFrom effectiveTo isActive note createdByUserId createdAt updatedAt
  bands { id minDistanceMeters maxDistanceMeters handlingMinutes transitMinutes estimatedCostAmount }`;

export const transitApi = {
  current: async () => (await graphql<{ currentTransitTable: TransitTable }>(
    `query { currentTransitTable { ${transitFields} } }`)).currentTransitTable,
  /** Published versions selected through GraphQL. */
  history: async () => (await graphql<{ transitTableHistory: TransitTable[] }>(
    `query { transitTableHistory { ${transitFields} } }`)).transitTableHistory,
  /** Publishing closes the current version and opens the next one; it never edits in place. */
  publish: (payload: PublishTransitTablePayload) => post<TransitTable>('/transit-tables', payload),
};

export const runScheduleApi = {
  /** Current preparation, buffer and dispatch-slot configuration. */
  current: async () => (await graphql<{ deliverySchedule: RunSchedule }>(
    'query { deliverySchedule { businessDate timeZone scheduleVersion preparationMinutes bufferMinutes dispatchSlotsLocalTime milestones { key label localTime at isAdvisory } } }')).deliverySchedule,
  /** Allocation is real-time; only the downstream warehouse timing is configurable. */
  publish: (payload: RunSchedulePayload) =>
    put<unknown>('/configurations/eta.schedule', { value: payload }),
};


export const backgroundJobsApi = {
  current: async (): Promise<BackgroundJobs> => {
    const { businessConfigurations: rows } = await graphql<{
      businessConfigurations: { key: string; value: unknown }[];
    }>('query { businessConfigurations { key value } }');
    const values = new Map(rows.map(row => [row.key, row.value]));
    const read = <T,>(key: string): T => {
      if (!values.has(key)) throw new Error('Thiếu cấu hình tác vụ nền. Kiểm tra migration backend.');
      return values.get(key) as T;
    };
    return {
      dateTracker: read<BackgroundJobs['dateTracker']>('jobs.date_tracker'),
      inventoryOutbox: read<BackgroundJobs['inventoryOutbox']>('jobs.inventory_outbox'),
      orderDeadline: read<BackgroundJobs['orderDeadline']>('jobs.order_deadline'),
      allocationRecovery: read<BackgroundJobs['allocationRecovery']>('jobs.allocation_recovery'),
    };
  },
  save: (settings: Partial<BackgroundJobs>) => put('/configurations/batch', { entries: [
    { key: 'jobs.date_tracker', value: settings.dateTracker },
    { key: 'jobs.inventory_outbox', value: settings.inventoryOutbox },
    { key: 'jobs.order_deadline', value: settings.orderDeadline },
    { key: 'jobs.allocation_recovery', value: settings.allocationRecovery },
  ].filter(entry => entry.value !== undefined) }),
};
