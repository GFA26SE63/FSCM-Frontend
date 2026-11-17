export type WarehouseWorkflow = 'inbound' | 'outbound' | 'transfer' | 'trace';

export const warehouseScreens = {
  inbound: { path: '/warehouse-inbound', title: 'Nhập kho', description: 'Nhập từ nhà máy hoặc nhận hàng luân chuyển từ kho khác; quét và xác nhận trên phiếu nhập.', create: '' },
  outbound: { path: '/warehouse-outbound', title: 'Xuất kho', description: 'Phát hành yêu cầu xuất cho đơn có PO, soạn carton và xác nhận xuất kho.', create: 'Tạo yêu cầu xuất kho' },
  transfer: { path: '/warehouse-transfers', title: 'Luân chuyển kho', description: 'Theo dõi yêu cầu chuyển hàng, xuất tại kho gửi và nhận tại kho đích.', create: 'Tạo yêu cầu luân chuyển' },
  trace: { path: '/warehouse-trace', title: 'Tra cứu carton', description: 'Tra cứu mã carton và lịch sử chứng từ qua các kho.', create: '' },
} as const;

type DocumentReference = { kind?: string; reason: 'Factory' | 'Order' | 'Transfer'; id: string };

export function belongsToWorkflow(document: DocumentReference, workflow: WarehouseWorkflow) {
  if (workflow === 'trace') return true;
  if (workflow === 'inbound') return document.reason === 'Factory' || document.reason === 'Transfer' && document.kind === 'Receipt';
  if (workflow === 'outbound') return document.reason === 'Order' || document.reason === 'Transfer' && ['Picking', 'Issue'].includes(document.kind ?? '');
  return document.reason === 'Transfer';
}

export function warehouseDocumentPath(document: DocumentReference) {
  const workflow = document.reason === 'Factory' ? 'inbound' : document.reason === 'Order' ? 'outbound' : document.kind === 'Receipt' ? 'inbound' : ['Picking', 'Issue'].includes(document.kind ?? '') ? 'outbound' : 'transfer';
  return `${warehouseScreens[workflow].path}/${encodeURIComponent(document.id)}`;
}
