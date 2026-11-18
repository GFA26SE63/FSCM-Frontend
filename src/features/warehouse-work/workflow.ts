export type WarehouseWorkflow = 'inbound' | 'outbound' | 'transfer' | 'trace';

export const warehouseScreens = {
  inbound: { path: '/warehouse-inbound', title: 'Nhập kho', description: 'Chọn hàng chờ nhận theo kho đích nhà máy đã chỉ định, kiểm đếm và nhận pallet.', create: '' },
  outbound: { path: '/warehouse-outbound', title: 'Xuất kho', description: 'Phát hành yêu cầu xuất cho đơn đã có đơn thực hiện, soạn thùng và xác nhận xuất kho.', create: 'Tạo yêu cầu xuất kho' },
  transfer: { path: '/warehouse-transfers', title: 'Luân chuyển kho', description: 'Theo dõi yêu cầu chuyển hàng, xuất tại kho gửi và nhận tại kho đích.', create: 'Tạo yêu cầu luân chuyển' },
  trace: { path: '/warehouse-trace', title: 'Tra cứu thùng', description: 'Tra cứu mã thùng và lịch sử chứng từ qua các kho.', create: '' },
} as const;

type DocumentReference = { reason: 'Factory' | 'Order' | 'Transfer'; id: string };

export function belongsToWorkflow(document: DocumentReference, workflow: WarehouseWorkflow) {
  return workflow === 'trace' || document.reason === ({ inbound: 'Factory', outbound: 'Order', transfer: 'Transfer' } as const)[workflow];
}

export function warehouseDocumentPath(document: DocumentReference) {
  const workflow = document.reason === 'Factory' ? 'inbound' : document.reason === 'Order' ? 'outbound' : 'transfer';
  return `${warehouseScreens[workflow].path}/${encodeURIComponent(document.id)}`;
}
