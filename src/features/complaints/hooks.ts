import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { complaintApi } from './api';

export const useComplaints = () => useQuery({ queryKey: ['complaints', 'list'], queryFn: complaintApi.list });
export const useComplaint = (code: string) => useQuery({ queryKey: ['complaints', 'detail', code], queryFn: () => complaintApi.get(code), enabled: !!code });
export const useComplaintEvidence = (id: string | undefined) =>
  useQuery({ queryKey: ['complaints', 'evidence', id], queryFn: () => complaintApi.evidence(id!), enabled: !!id });
export const useDecideComplaint = () => useApiMutation(complaintApi.decide, { success: (c) => `Đã cập nhật khiếu nại ${c.code}.` });
export const useResolveComplaint = () => useApiMutation(complaintApi.resolve, { success: (c) => `Đã ghi nhận xử lý khiếu nại ${c.code} và báo retailer.` });
export const useCompleteRequestHandling = () => useApiMutation(complaintApi.completeHandling, { success: c => c.status === 'Resolved' ? 'Đã xác nhận xử lý thực tế và chốt phương án.' : 'Đã ghi nhận xử lý thực tế; đang chờ đủ điều kiện chốt tài chính.' });
