import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { rotationApi } from './api';

export const useProposals = () => useQuery({ queryKey: ['rotation', 'list'], queryFn: rotationApi.list });
export const useProposal = (id: string) => useQuery({ queryKey: ['rotation', 'detail', id], queryFn: () => rotationApi.get(id) });
export const useApproveProposal = () => useApiMutation(rotationApi.approve, { success: (p) => `Đã duyệt: tạo phiếu điều chuyển ${p.transferCode} (${p.fromWarehouseName} → ${p.toWarehouseName}).` });
export const useSkipProposal = () => useApiMutation(rotationApi.skip, { success: 'Đã bỏ qua đề xuất.' });
export const useUpdateProposalQty = () => useApiMutation(rotationApi.updateQty, { success: 'Đã cập nhật số lượng đề xuất.' });
export const useRunRotation = () => useApiMutation(rotationApi.run, { success: (r) => `Đã chạy lại job: ${r.batchesWithExcess} batch dư, ${r.proposals} đề xuất chờ duyệt.` });
