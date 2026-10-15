import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { disposalApi } from './api';

export const useDisposals = () => useQuery({ queryKey: ['disposal', 'list'], queryFn: disposalApi.list });
export const useDisposal = (code: string) => useQuery({ queryKey: ['disposal', 'detail', code], queryFn: () => disposalApi.get(code) });
export const useDisposalCandidates = () => useQuery({ queryKey: ['disposal', 'candidates'], queryFn: disposalApi.candidates });
export const useCreateDisposal = () => useApiMutation(disposalApi.create, { success: (r) => `Đã lập phiếu hủy ${r.items.map((d) => d.code).join(', ')}; tồn batch về 0.` });
