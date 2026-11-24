export type WarehouseWorkflow = 'inbound' | 'receipts' | 'outbound' | 'issues' | 'transfer' | 'trace';

export const warehouseScreens = {
  inbound: { path: '/warehouse-inbound', title: 'Nhập kho', description: 'Tiếp nhận kiện pallet từ nhà máy hoặc hàng luân chuyển từ kho khác; kiểm đếm và ghi sổ phiếu nhập kho.', create: '' },
  factoryRequests: { path: '/warehouse-factory-requests', title: 'Yêu cầu nhận hàng từ nhà máy', description: 'Tiếp nhận các phiếu xuất xưởng của nhà máy và mở phiếu kiểm đếm khi hàng đến kho.', create: '' },
  receipts: { path: '/warehouse-receipts', title: 'Phiếu nhập kho (PNK)', description: 'Quản lý, tra cứu và in các phiếu nhập kho đã lập hoặc đã ghi nhận tồn.', create: '' },
  outbound: { path: '/warehouse-outbound', title: 'Xuất kho', description: 'Phát hành yêu cầu xuất cho đơn đã có đơn thực hiện, soạn thùng và xác nhận xuất kho.', create: 'Tạo yêu cầu xuất kho' },
  issues: { path: '/warehouse-issues', title: 'Phiếu xuất kho (PXK)', description: 'Quản lý, tra cứu và in các phiếu xuất kho đã ghi sổ trừ tồn và bàn giao vận chuyển.', create: '' },
  transfer: { path: '/warehouse-transfers', title: 'Luân chuyển kho', description: 'Admin lập lệnh điều chuyển nội bộ giữa hai kho. Thủ kho gửi xuất hàng; thủ kho nhận kiểm đếm và ghi sổ nhập kho.', create: 'Lập lệnh điều chuyển kho' },
  trace: { path: '/warehouse-trace', title: 'Tra cứu thùng', description: 'Tra cứu mã thùng và lịch sử chứng từ qua các kho.', create: '' },
} as const;

type DocumentReference = { kind?: string; reason: 'Factory' | 'Order' | 'Transfer'; id: string };

export function belongsToWorkflow(document: DocumentReference, workflow: WarehouseWorkflow) {
  if (workflow === 'trace') return true;
  if (workflow === 'inbound' || workflow === 'receipts') return document.reason === 'Factory' || document.reason === 'Transfer' && document.kind === 'Receipt';
  if (workflow === 'outbound' || workflow === 'issues') return document.reason === 'Order' || document.reason === 'Transfer' && ['Picking', 'Issue'].includes(document.kind ?? '');
  return document.reason === 'Transfer';
}

export function warehouseDocumentPath(document: DocumentReference) {
  const workflow = document.reason === 'Factory' ? 'inbound' : document.reason === 'Order' ? 'outbound' : document.kind === 'Receipt' ? 'inbound' : ['Picking', 'Issue'].includes(document.kind ?? '') ? 'outbound' : 'transfer';
  return `${warehouseScreens[workflow].path}/${encodeURIComponent(document.id)}`;
}
