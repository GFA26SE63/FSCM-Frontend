import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get } from '@/shared/api/http';
import { useApiMutation } from '@/shared/hooks';
import { useAuth } from '@/shared/auth/AuthContext';

import { qrLabelApi } from './api';
import type { GenerateQrLabelRequest, PrintTarget } from './types';

function isUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function useBatchInventory(batchId: string, enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'batches', batchId],
    queryFn: async () => {
      let data: Record<string, unknown> | null = null;
      if (isUuid(batchId)) {
        try {
          data = await get<Record<string, unknown>>(`/inventory/batches/${encodeURIComponent(batchId)}`);
        } catch {
          data = null;
        }
      }
      if (!data) {
        try {
          const list = await get<Record<string, unknown>[]>('/inventory');
          if (Array.isArray(list)) {
            data =
              list.find(
                (item) =>
                  String(item.batchId ?? item.id ?? '').toLowerCase() === batchId.toLowerCase() ||
                  String(item.batchCode ?? item.code ?? '').toLowerCase() === batchId.toLowerCase(),
              ) ?? null;
          }
        } catch {
          data = null;
        }
      }

      if (!data) {
        return null;
      }

      const onHand = Number(data.onHandQuantity ?? data.onHand ?? 0);
      const reserved = Number(data.reservedQuantity ?? data.held ?? 0);
      const locked = Number(data.lockedQuantity ?? data.locked ?? 0);
      const available = Number(
        data.availableQuantity ?? data.available ?? Math.max(0, onHand - reserved - locked),
      );

      return {
        batchId: String(data.batchId ?? data.id ?? batchId),
        batchCode: String(data.batchCode ?? data.code ?? ''),
        sku: String(data.sku ?? ''),
        productName: String(data.productName ?? ''),
        warehouseId: data.warehouseId ? String(data.warehouseId) : undefined,
        warehouseCode: data.warehouseCode ? String(data.warehouseCode) : undefined,
        warehouseName: data.warehouseName ? String(data.warehouseName) : undefined,
        expirationDate: data.expirationDate ? String(data.expirationDate) : undefined,
        onHandQuantity: onHand,
        availableQuantity: available,
        expiryStatus: data.expiryStatus ? String(data.expiryStatus) : undefined,
      };
    },
    enabled: Boolean(batchId && enabled),
    staleTime: 30_000,
  });
}

export function useBatchQrLabels(
  ownerId: string,
  batchId: string,
) {
  return useQuery({
    queryKey: [
      'qr-labels',
      'batch',
      ownerId,
      batchId,
    ],
    queryFn: () => qrLabelApi.listByBatch(batchId),
    enabled: Boolean(ownerId && batchId),
    retry: false,
    gcTime: 0,
  });
}

export function useAllQrLabels(warehouseId?: string) {
  return useQuery({
    queryKey: ['qr-labels', 'all', warehouseId],
    queryFn: () => qrLabelApi.list(warehouseId ? { warehouseId } : undefined),
    staleTime: 30_000,
  });
}

export function useGenerateQrLabel() {
  const queryClient = useQueryClient();

  return useApiMutation(
    (req: GenerateQrLabelRequest) => qrLabelApi.generate(req),
    {
      permission: 'qr.generate',
      success: 'Sinh mã QR thành công.',
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: ['qr-labels'] });
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        if (vars.batchId) {
          queryClient.invalidateQueries({ queryKey: ['batch', vars.batchId] });
        }
      },
    },
  );
}

export function useQrGenerationCapacity(batchId: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['qr-labels', 'generation-capacity', user?.id, batchId],
    queryFn: () => qrLabelApi.generationCapacity(batchId),
    enabled: Boolean(user?.id && batchId && enabled),
    staleTime: 0,
  });
}

export function useLabelPrintDocument(
  ownerId: string,
  target: PrintTarget,
) {
  const identifier =
    target.kind === 'label'
      ? target.qrCode
      : target.batchId;

  return useQuery({
    queryKey: [
      'qr-labels',
      'print-document',
      ownerId,
      target.kind,
      identifier,
    ],
    queryFn: () => qrLabelApi.printable(target),
    enabled: Boolean(ownerId && identifier),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
