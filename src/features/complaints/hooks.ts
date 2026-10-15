import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { complaintApi } from './api';

export const useComplaints = () => useQuery({ queryKey: ['complaints', 'list'], queryFn: complaintApi.list });
export const useComplaint = (code: string) => useQuery({ queryKey: ['complaints', 'detail', code], queryFn: () => complaintApi.get(code) });
export const useResolveComplaint = () => useApiMutation(complaintApi.resolve, { success: (c) => `Đã ghi nhận xử lý khiếu nại ${c.code} và báo retailer.` });
