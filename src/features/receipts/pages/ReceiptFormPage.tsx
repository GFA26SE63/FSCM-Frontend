import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, FormField, Input, PageHeader, Select } from '@/shared/ui';
import { useCreateReceipt, useReceiptLookups } from '../hooks';

interface Row {
  productId: string;
  productionDate: string;
  expirationDate: string;
  quantity: string;
  sourceLotCode: string;
}

const blank = (): Row => ({ productId: '', productionDate: '', expirationDate: '', quantity: '', sourceLotCode: '' });

/** Warehouse Keeper selects a published product; the Portal submits backend IDs, never a typed SKU. */
export function ReceiptFormPage() {
  const navigate = useNavigate();
  const { warehouses, products } = useReceiptLookups();
  const create = useCreateReceipt();
  const [warehouseId, setWarehouseId] = useState('');
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [tried, setTried] = useState(false);

  const whs = (warehouses.data ?? []).filter((warehouse) => warehouse.isActive);
  const prods = (products.data ?? []).filter((product) => product.status === 'Published');
  const selectedWarehouseId = warehouseId || whs[0]?.id || '';
  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const rowError = (row: Row) =>
    !row.productId ? 'Chọn sản phẩm'
      : !row.productionDate ? 'Nhập ngày sản xuất'
        : !row.expirationDate ? 'Nhập hạn sử dụng'
          : row.expirationDate <= row.productionDate ? 'HSD phải sau ngày sản xuất'
            : !(Number(row.quantity) > 0) ? 'Số lượng phải lớn hơn 0'
              : null;
  const invalid = rows.some(rowError);

  const submit = async () => {
    setTried(true);
    if (invalid || !selectedWarehouseId) return;
    const receipt = await create.mutateAsync({
      warehouseId: selectedWarehouseId,
      operationKey: crypto.randomUUID(),
      lines: rows.map((row) => ({
        productId: row.productId,
        sourceLotCode: row.sourceLotCode.trim() || null,
        quantity: Number(row.quantity),
        productionDate: row.productionDate,
        expirationDate: row.expirationDate,
      })),
    });
    navigate(`/receipts/${receipt.id}`);
  };

  return (
    <>
      <PageHeader back="/receipts" title="Tạo phiếu nhập kho" subtitle="Chọn sản phẩm từ danh mục. Tạo phiếu chưa tăng tồn; duyệt phiếu mới sinh/ghép batch và cộng tồn kho." />
      <Card title="Thông tin phiếu">
        <FormField label="Kho nhận" required>
          <Select value={selectedWarehouseId} onChange={(event) => setWarehouseId(event.target.value)} options={whs.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.code} · ${warehouse.name}` }))} />
        </FormField>
      </Card>
      <Card title="Dòng hàng nhập" actions={<Button size="sm" onClick={() => setRows((current) => [...current, blank()])}>+ Thêm dòng</Button>}>
        <div className="stack-sm">
          {rows.map((row, index) => {
            const product = prods.find((item) => item.id === row.productId);
            return (
              <div key={index} className="form-grid" style={{ gridTemplateColumns: '2fr 1.1fr 1.1fr 0.8fr 1.2fr auto', alignItems: 'end' }}>
                <FormField label="Sản phẩm / SKU" error={tried ? rowError(row) : null}>
                  <Select value={row.productId} placeholder="— Chọn sản phẩm —" onChange={(event) => update(index, { productId: event.target.value })} options={prods.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))} />
                </FormField>
                <FormField label="Ngày sản xuất"><Input type="date" value={row.productionDate} onChange={(event) => update(index, { productionDate: event.target.value })} /></FormField>
                <FormField label="Hạn sử dụng"><Input type="date" value={row.expirationDate} onChange={(event) => update(index, { expirationDate: event.target.value })} /></FormField>
                <FormField label="Số lượng"><Input inputMode="decimal" value={row.quantity} onChange={(event) => update(index, { quantity: event.target.value })} /></FormField>
                <FormField label="Mã lô nhà sản xuất"><Input value={row.sourceLotCode} onChange={(event) => update(index, { sourceLotCode: event.target.value })} /></FormField>
                <Button size="sm" variant="danger" disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Xóa</Button>
                {product && <span className="muted small" style={{ gridColumn: '1 / -1' }}>Đã chọn: <b>{product.sku} · {product.name}</b>. Mã batch được hệ thống sinh khi duyệt phiếu.</span>}
              </div>
            );
          })}
        </div>
      </Card>
      {tried && (invalid || !selectedWarehouseId) && <Callout tone="danger">Vui lòng hoàn tất các dòng hàng còn thiếu hoặc chưa hợp lệ.</Callout>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => navigate('/receipts')}>Hủy</Button>
        <Button variant="primary" loading={create.isPending} onClick={submit}>Tạo phiếu chờ duyệt</Button>
      </div>
    </>
  );
}
