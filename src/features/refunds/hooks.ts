import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { refundApi } from './api';

export const useRefunds = () => useQuery({ queryKey: ['refunds', 'list'], queryFn: refundApi.list });
export const useCreateRefund = () => useApiMutation(refundApi.create, { success: 'Đã tạo nghĩa vụ hoàn tiền.' });
export const useSubmitRefundEvidence = () => useApiMutation(refundApi.submitEvidence, { success: 'Đã gửi bằng chứng chuyển khoản.' });
export const useVerifyRefund = () => useApiMutation(refundApi.verify, { success: 'Đã xác nhận hoàn tiền.' });
