import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { allocationApi } from './api';

export const allocationKeys = {
  list: (fromDate: string, toDate: string) => ['allocation', 'list', fromDate, toDate] as const,
  run: (businessDate: string) => ['allocation', 'run', businessDate] as const,
  detail: (runId: string) => ['allocation', 'detail', runId] as const,
  versions: (runId: string) => ['allocation', 'versions', runId] as const,
};

export const useAllocationRuns = (fromDate: string, toDate: string) =>
  useQuery({
    queryKey: allocationKeys.list(fromDate, toDate),
    queryFn: () => allocationApi.list({ fromDate: fromDate || undefined, toDate: toDate || undefined }),
  });

export const useAllocationRun = (businessDate: string) =>
  useQuery({ queryKey: allocationKeys.run(businessDate), queryFn: () => allocationApi.runByDate(businessDate) });

export const useAllocationRunDetail = (runId: string) =>
  useQuery({ queryKey: allocationKeys.detail(runId), queryFn: () => allocationApi.run(runId), enabled: !!runId });

export const usePlanVersions = (runId: string | undefined) =>
  useQuery({
    queryKey: allocationKeys.versions(runId ?? ''),
    queryFn: () => allocationApi.planVersions(runId as string),
    enabled: !!runId,
  });

export const useStartAllocationRun = () =>
  useApiMutation(allocationApi.start, {
    success: (run) => `Đã chạy đợt ${run.runCode}. Phương án hàng và giá đang chờ Admin duyệt.`,
  });

export const useApprovePlan = () =>
  useApiMutation(allocationApi.approve, {
    success: (v) =>
      `Đã duyệt phương án bản ${v.versionNumber} của đợt ${v.runCode}. Hàng đã được giữ và báo giá sẵn sàng gửi Retailer.`,
  });

export const useRequestRecalculation = () =>
  useApiMutation(allocationApi.requestRecalculation, {
    success: (v) => `Đã yêu cầu tính lại đợt ${v.runCode}. Bản mới sẽ được trình duyệt lại, bản cũ giữ nguyên để đối chiếu.`,
  });

export const useCloseAllocationRun = () =>
  useApiMutation(allocationApi.close, {
    success: (run) => `Đã đóng đợt ${run.runCode}. Báo cáo đợt đã được khóa để đối chiếu.`,
  });

export const useIssuePicking = () => useApiMutation(allocationApi.issuePicking, { success: 'Đã sinh hoặc bổ sung phiếu nhặt cho các đơn có PO.' });
