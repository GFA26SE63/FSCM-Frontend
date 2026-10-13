import { get, put } from '@/shared/api/http';
import type { ConfigDraft, SystemSettings, TransitBand, TransitTable } from './types';

export const configApi = {
  settings: () => get<SystemSettings>('/settings'),
  transit: () => get<TransitTable>('/transit-table'),
  saveSettings: (s: SystemSettings) => put<SystemSettings>('/settings', s),
  saveTransit: (bands: TransitBand[]) => put<TransitTable>('/transit-table', { bands }),
  /** One "Lưu cấu hình" click saves both resources (settings first, then the shared transit table). */
  save: async (d: ConfigDraft) => {
    await configApi.saveSettings(d.settings);
    await configApi.saveTransit(d.bands);
  },
};
