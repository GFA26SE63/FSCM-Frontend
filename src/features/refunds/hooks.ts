import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks/useApiMutation';
import { refundApi } from './api';

export const refundKeys = {
  list: ['refunds', 'list'] as const,
  detail: (id: string) => ['refunds', 'detail', id] as const,
  obligations: ['refunds', 'obligations'] as const,
};

export const useRefunds = () => useQuery({ queryKey: refundKeys.list, queryFn: () => refundApi.list() });

export const useRefund = (id: string) =>
  useQuery({ queryKey: refundKeys.detail(id), queryFn: () => refundApi.get(id), enabled: !!id });

export const useRefundObligations = (enabled: boolean) =>
  useQuery({ queryKey: refundKeys.obligations, queryFn: refundApi.obligations, enabled });

/** Short-lived read URL for an uploaded proof image; null when the reference is plain text. */
export const useEvidenceUrl = (reference: string | null) =>
  useQuery({
    queryKey: ['refunds', 'evidence-url', reference],
    queryFn: () => refundApi.evidenceUrl(reference as string),
    enabled: !!reference && reference.startsWith('blob:'),
    staleTime: 60_000,
  });

export const useCreateRefund = () =>
  useApiMutation(refundApi.create, {
    permission: 'refunds.manage',
    success: 'Đã tạo hồ sơ hoàn tiền. Chưa có khoản tiền nào được chuyển.',
  });

export const useSubmitRefundEvidence = () =>
  useApiMutation(refundApi.submitEvidence, {
    permission: 'refunds.manage',
    success: 'Đã gửi bằng chứng chuyển tiền để Admin xác minh.',
  });

export const useVerifyRefund = () =>
  useApiMutation(refundApi.verify, {
    permission: 'refunds.verify',
    success: (refund) =>
      refund.status === 'Refunded' ? 'Đã xác minh: khoản hoàn đã chuyển.' : 'Đã trả bằng chứng để nộp lại.',
  });
