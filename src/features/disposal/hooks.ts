import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { disposalApi } from './api';

export const useDisposals = (warehouseId?: string) =>
  useQuery({
    queryKey: ['disposal', 'list', warehouseId ?? 'all'],
    queryFn: () => disposalApi.list(warehouseId),
  });

export const useDisposal = (idOrCode: string) =>
  useQuery({
    queryKey: ['disposal', 'detail', idOrCode],
    queryFn: () => disposalApi.get(idOrCode),
    enabled: Boolean(idOrCode),
  });

export const useDisposalCandidates = (warehouseId?: string) =>
  useQuery({
    queryKey: ['disposal', 'candidates', warehouseId ?? 'all'],
    queryFn: () => disposalApi.candidates(warehouseId),
  });

export const useCreateDisposal = () => {
  const queryClient = useQueryClient();
  return useApiMutation(disposalApi.create, {
    success: (r) => `Đã lập phiếu hủy ${r.code || ''} thành công.`,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposal'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
};

export const useApproveDisposal = () => {
  const queryClient = useQueryClient();
  return useApiMutation(disposalApi.approve, {
    success: (r) => `Đã duyệt phiếu hủy ${r.code || ''}: tồn kho thực tế đã được cập nhật.`,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposal'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-locks'] });
    },
  });
};

export const useRejectDisposal = () => {
  const queryClient = useQueryClient();
  return useApiMutation(
    ({ id, reason }: { id: string; reason?: string }) => disposalApi.reject(id, reason),
    {
      success: (r) => `Đã từ chối phiếu hủy ${r.code || ''}.`,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['disposal'] });
      },
    },
  );
};

export const useWriteOffAttachments = (writeOffId: string) =>
  useQuery({
    queryKey: ['write-offs', writeOffId, 'attachments'],
    queryFn: () => disposalApi.getAttachments(writeOffId),
    enabled: Boolean(writeOffId),
  });

export const useUploadAttachment = (writeOffId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (file: File) => disposalApi.uploadAttachment(writeOffId, file),
    {
      success: 'Đã tải lên tệp đính kèm.',
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['write-offs', writeOffId, 'attachments'],
        });
      },
    },
  );
};

export const useDeleteAttachment = (writeOffId: string) => {
  const queryClient = useQueryClient();
  return useApiMutation(
    (attachmentId: string) => disposalApi.deleteAttachment(writeOffId, attachmentId),
    {
      success: 'Đã xóa tệp đính kèm.',
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ['write-offs', writeOffId, 'attachments'],
        });
      },
    },
  );
};
