import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { disposalApi } from './api';
import { fetchDisposalLineTotals, fetchDisposalsPage, type DisposalsPageQuery } from './disposalGraphql';

/** Server-side cursor-paginated disposals via GraphQL entities.writeOffs. */
export const useDisposalsPage = (q: DisposalsPageQuery) =>
  useQuery({
    queryKey: ['disposal', 'page', q],
    queryFn: () => fetchDisposalsPage(q),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 15_000,
  });

/** One batched request set per page: line count + total quantity per write-off. Never throws. */
export const useDisposalLineTotalsForPage = (ids: string[]) => {
  const sorted = [...ids].sort();
  return useQuery({
    queryKey: ['disposal', 'lineTotals', sorted],
    queryFn: () => fetchDisposalLineTotals(sorted),
    enabled: sorted.length > 0,
    staleTime: 15_000,
    retry: false,
  });
};

export const useDisposals = () => useQuery({ queryKey: ['disposal', 'list'], queryFn: disposalApi.list });
export const useDisposal = (code: string) => useQuery({ queryKey: ['disposal', 'detail', code], queryFn: () => disposalApi.get(code) });
export const useDisposalCandidates = () => useQuery({ queryKey: ['disposal', 'candidates'], queryFn: disposalApi.candidates });
export const useCreateDisposal = () => {
  const queryClient = useQueryClient();
  return useApiMutation(disposalApi.create, {
    success: (r) => `Đã lập phiếu hủy ${r.items.map((d) => d.code).join(', ')}; tồn lô hàng về 0.`,
    // The paged list is cached for 15s; drop it so the new phiếu shows immediately.
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['disposal'] }); },
  });
};
