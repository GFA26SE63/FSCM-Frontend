import { useQuery } from '@tanstack/react-query';

import { qrLabelApi } from './api';
import type { PrintTarget } from './types';

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