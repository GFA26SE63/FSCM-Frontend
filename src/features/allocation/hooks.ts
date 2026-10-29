import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { allocationApi } from './api';

export const allocationKeys = {
  run: (businessDate: string) => ['allocation', 'run', businessDate] as const,
  versions: (runId: string) => ['allocation', 'versions', runId] as const,
};

export const useAllocationRun = (businessDate: string) =>
  useQuery({ queryKey: allocationKeys.run(businessDate), queryFn: () => allocationApi.runByDate(businessDate) });

export const usePlanVersions = (runId: string | undefined) =>
  useQuery({
    queryKey: allocationKeys.versions(runId ?? ''),
    queryFn: () => allocationApi.planVersions(runId as string),
    enabled: !!runId,
  });

export const useApprovePlan = () =>
  useApiMutation(allocationApi.approve, {
    permission: 'allocation.approve',
    success: (v) =>
      `Đã duyệt phương án bản ${v.versionNumber} của đợt ${v.runCode}. Hàng đã được giữ; phiếu soạn phát hành theo từng kho.`,
  });

export const useRequestRecalculation = () =>
  useApiMutation(allocationApi.requestRecalculation, {
    permission: 'allocation.recalculate',
    success: (v) => `Đã yêu cầu tính lại đợt ${v.runCode}. Bản mới sẽ được trình duyệt lại, bản cũ giữ nguyên để đối chiếu.`,
  });
