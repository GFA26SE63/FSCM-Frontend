export interface QrLabel {
  id: string;
  qrCode: string;
  qrPayload: string;

  batchId: string;
  batchCode: string;

  warehouseId: string;
  warehouseCode: string;

  productId: string;
  sku: string;
  productName: string;

  productionDate: string;
  expirationDate: string;

  goodsReceiptId: string | null;
  receiptCode: string | null;

  quantity: number;
  status: string;

  parentLabelId: string | null;
  parentQrCode: string | null;

  rootLabelId: string;
  rootQrCode: string;

  blobUrl: string | null;
  version: number;

  generatedAt: string;
  updatedAt: string;
  invalidatedAt: string | null;
}

export interface QrLabelEvent {
  id: string;
  operationKey: string;
  eventType: string;

  warehouseId: string;
  warehouseCode: string;

  fromStatus: string;
  toStatus: string;

  quantity: number;
  referenceCode: string | null;
  note: string | null;

  performedByUserId: string;
  occurredAt: string;
}

export interface QrLabelDetail {
  label: QrLabel;
  lineage: QrLabel[];
  events: QrLabelEvent[];
}

export interface GenerateQrLabelRequest {
  batchId: string;
  quantity: number;
  blobUrl?: string | null;
}

export type PrintTarget =
  | {
      kind: 'label';
      qrCode: string;
    }
  | {
      kind: 'batch';
      batchId: string;
    };

export function isPrintableLabel(label: QrLabel): boolean {
  return (
    label.status !== 'Invalidated' &&
    label.invalidatedAt === null
  );
}

export function labelStatusText(status: string): string {
  const labels: Record<string, string> = {
    Available: 'Sẵn sàng',
    Picked: 'Đã soạn',
    InTransit: 'Đang giao',
    Delivered: 'Đã giao',
    Invalidated: 'Đã vô hiệu hóa',
  };

  return labels[status] ?? status;
}
export interface QrGenerationCapacity {
  batchId: string;
  physicalQuantity: number;
  labelledQuantity: number;
  unlabelledQuantity: number;
}
