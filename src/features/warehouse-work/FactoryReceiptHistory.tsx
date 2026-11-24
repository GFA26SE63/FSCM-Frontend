import { useState } from 'react';
import { Fields, Modal, SimpleTable } from '@/shared/ui';
import { formatDate, formatInstantDateTime } from '@/shared/lib/dates';
import { combinedLines, dispatchLabel, rowCartons, rowStatus, type HistoryDoc, type HistoryRow } from './receiptHistoryModel';

/**
 * PNK history for factory receipts: one row per dispatch note. A note received on several older per-pallet PNKs
 * opens a popup with every pallet, carton result and stock batch of the note, and a link to each PNK.
 */
export function FactoryReceiptHistory<T extends HistoryDoc>({ rows, whName, statusText, onOpen }: {
  rows: HistoryRow<T>[];
  whName: (id: string) => string;
  statusText: (status: string) => string;
  onOpen: (documentId: string) => void;
}) {
  const [shown, setShown] = useState<HistoryRow<T> | null>(null);
  const open = (row: HistoryRow<T>) => (row.docs.length > 1 ? setShown(row) : onOpen(row.docs[0].document.id));
  const chip = (status: string) => <span className={`chip ${status === 'Posted' ? 'tone-success' : 'tone-warn'}`}>{statusText(status)}</span>;
  return <>
    <SimpleTable rows={rows} columns={[
      { header: 'Phiếu nhập / ngày nhận', width: '300px', cell: r => <div>
        <b className="warehouse-pallet-code">{r.docs.length > 1 ? `${r.docs.length} PNK · ${r.docs[0].document.code}…` : r.docs[0].document.code}</b>
        <div className="muted">{formatInstantDateTime(r.docs[0].document.createdAt)}</div>
      </div> },
      { header: 'Phiếu xuất nhà máy', width: '280px', cell: r => dispatchLabel(r) },
      { header: 'Kho nhận', width: '200px', cell: r => whName(r.docs[0].document.warehouseId) },
      { header: 'Số thùng', width: '120px', cell: r => `${rowCartons(r)} carton` },
      { header: 'Trạng thái', width: '150px', cell: r => chip(rowStatus(r)) },
      { header: 'Thao tác', width: '150px', cell: r => <button className="btn btn-sm" onClick={() => open(r)}>{r.docs.length > 1 ? 'Xem chi tiết' : 'Xem & in phiếu'}</button> },
    ]} empty="Không có chứng từ phù hợp." />
    <Modal
      open={!!shown}
      width={980}
      title={shown ? `Phiếu xuất nhà máy ${shown.group?.dispatchCode ?? ''}`.trim() : ''}
      subtitle={shown ? `${shown.docs.length} phiếu nhập kho · ${shown.group?.pallets.length ?? 0} pallet` : undefined}
      onClose={() => setShown(null)}
      footer={<button className="btn" onClick={() => setShown(null)}>Đóng</button>}
    >
      {shown && <div className="stack" style={{ gap: 16 }}>
        <Fields cols={3} items={[
          { label: 'Kho nhận', value: whName(shown.docs[0].document.warehouseId) },
          { label: 'Thời gian xuất xưởng', value: shown.group?.dispatchedAt ? formatInstantDateTime(shown.group.dispatchedAt) : '—' },
          { label: 'Trạng thái', value: chip(rowStatus(shown)) },
        ]} />
        <p className="muted" style={{ margin: 0 }}>Các pallet của phiếu xuất này được nhận trên nhiều phiếu nhập (cách nhận cũ, mỗi pallet một PNK). Từ nay mỗi phiếu xuất được nhận trên một PNK.</p>
        <div>
          <h3 className="sec" style={{ marginBottom: 8 }}>Phiếu nhập kho</h3>
          <SimpleTable rows={shown.docs} columns={[
            { header: 'Mã PNK', cell: w => w.document.code },
            { header: 'Lập lúc', cell: w => formatInstantDateTime(w.document.createdAt) },
            { header: 'Số thùng', align: 'right', cell: w => `${w.lines.reduce((s, l) => s + l.quantity, 0)} carton` },
            { header: 'Trạng thái', cell: w => chip(w.document.status) },
            { header: '', align: 'right', cell: w => <button className="btn btn-sm" onClick={() => { setShown(null); onOpen(w.document.id); }}>Xem & in phiếu</button> },
          ]} />
        </div>
        <div>
          <h3 className="sec" style={{ marginBottom: 8 }}>Pallet và kết quả kiểm đếm</h3>
          <SimpleTable rows={shown.group?.pallets ?? []} empty="Chưa có pallet nào được xác nhận." columns={[
            { header: 'Pallet', cell: p => <b className="warehouse-pallet-code">{p.palletCode}</b> },
            { header: 'PNK', cell: p => shown.docs.find(w => w.document.id === p.documentId)?.document.code ?? '—' },
            { header: 'Đạt', align: 'right', cell: p => p.accepted },
            { header: 'Hỏng · cách ly', align: 'right', cell: p => p.damaged },
            { header: 'Thiếu', align: 'right', cell: p => p.missing },
          ]} />
        </div>
        <div>
          <h3 className="sec" style={{ marginBottom: 8 }}>Hàng nhập theo lô</h3>
          <SimpleTable rows={combinedLines(shown)} empty="Chưa ghi nhận thùng đạt." columns={[
            { header: 'SKU / sản phẩm', cell: l => `${l.sku} · ${l.productName}` },
            { header: 'Lô hàng kho / lô nhà máy', cell: l => [l.batchCode, l.sourceLotCode].filter(Boolean).join(' · ') || '—' },
            { header: 'HSD', cell: l => formatDate(l.expirationDate) },
            { header: 'Thùng đạt', align: 'right', cell: l => l.quantity },
          ]} />
        </div>
      </div>}
    </Modal>
  </>;
}
