import { get, getAll, put } from '@/shared/api/http';
import type { BalanceRow, LoyaltyProgram, ProgramInput, RetailerLoyalty } from './types';

export const loyaltyApi = {
  program: () => get<LoyaltyProgram[]>('/loyalty/programs').then((x) => x[0]),
  updateProgram: (v: ProgramInput & { code: string }) => put<LoyaltyProgram>(`/loyalty/programs/${v.code}`, v),
  balances: () => getAll<BalanceRow>('/loyalty/retailers'),
  retailer: (code: string) => get<RetailerLoyalty>(`/loyalty/retailers/${code}`),
};
