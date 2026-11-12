import { useRef, useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, DataTable, FormField, Input, PageHeader, Select, type Column } from '@/shared/ui';
import { addDays, vietnamDate } from '@/shared/lib';
import { errorMessage } from '@/shared/api/errors';
import { useCreatePromo, usePromoLookups } from '../hooks';
import type { ProductOption, PromoInput, RetailerOption } from '../types';
import { PromoSelectionModal } from '../components/PromoSelectionModal';

interface RuleRow { productId: string; minimumQuantity: string; discountPercent: string }
const blank = (): RuleRow => ({ productId: '', minimumQuantity: '', discountPercent: '' });

export function PromoFormPage() {
  const navigate = useNavigate();
  const { products, retailers } = usePromoLookups();
  const create = useCreatePromo();
  const submission = useRef<{ signature: string; requestId: string } | null>(null);
  const today = vietnamDate();
  const [name, setName] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [mode, setMode] = useState<'PerSku' | 'ProductGroup'>('PerSku');
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [minQty, setMinQty] = useState('');
  const [pct, setPct] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [retailerIds, setRetailerIds] = useState<string[]>([]);
  const [picker, setPicker] = useState<'products' | 'retailers' | null>(null);
  const [tried, setTried] = useState(false);
  const prods = (products.data ?? []).filter((p) => p.status === 'Published');
  const selectedProductIds = mode === 'PerSku' ? rows.map(row => row.productId) : productIds;
  const selectedProducts = selectedProductIds.flatMap(id => prods.find(p => p.id === id) ?? []);
  const productColumns: Column<ProductOption>[] = [
    { key: 'sku', header: 'Mã SKU', width: '160px' },
    { key: 'name', header: 'Tên sản phẩm', width: '300px' },
  ];
  const applyProducts = (ids: string[]) => {
    if (mode === 'PerSku') setRows(ids.map(productId => rows.find(r => r.productId === productId) ?? { ...blank(), productId }));
    else setProductIds(ids);
    setPicker(null);
  };
  const retailerColumns: Column<RetailerOption>[] = [
    { key: 'code', header: 'Mã cửa hàng', width: '150px' },
    { key: 'name', header: 'Tên cửa hàng', width: '230px' },
    { key: 'contact', header: 'Liên hệ', width: '200px', text: (r) => `${r.contactName || '—'} · ${r.phone || '—'}` },
    { key: 'address', header: 'Địa chỉ', width: '260px', text: (r) => r.address || '—' },
    { key: 'salesGroupCode', header: 'Nhóm Sales', width: '130px', text: (r) => r.salesGroupCode || '—' },
    { key: 'creditTermDays', header: 'Hạn công nợ', width: '130px', text: (r) => r.creditTermDays == null ? '—' : r.creditTermDays > 0 ? `${r.creditTermDays} ngày` : 'Trả trước' },
  ];
  const validQty = (v: string) => Number(v) > 0 && Number(v) <= 999999999999999 && Number.isInteger(Number(v));
  const validPct = (v: string) => Number(v) >= 1 && Number(v) <= 100 && Number(Number(v).toFixed(2)) === Number(v);
  const invalidRows = !rows.length || rows.some((r) => !r.productId || !validQty(r.minimumQuantity) || !validPct(r.discountPercent)) || new Set(rows.map((r) => r.productId)).size !== rows.length;
  const invalid = name.trim().length < 3 || name.trim().length > 200 || !from || from < today || !to || to < from ||
    (mode === 'PerSku' ? invalidRows : !productIds.length || !validQty(minQty) || !validPct(pct));
  const update = (productId: string, patch: Partial<RuleRow>) => setRows(r => r.map(x => x.productId === productId ? { ...x, ...patch } : x));
  const submit = async (activateOnSave: boolean) => {
    setTried(true);
    if (invalid || create.isPending) return;
    try {
      const input: Omit<PromoInput, 'requestId'> = { name: name.trim(), campaignMode: mode,
        minimumQuantity: mode === 'PerSku' ? Math.min(...rows.map((r) => Number(r.minimumQuantity))) : Number(minQty),
        discountPercent: mode === 'PerSku' ? Math.max(...rows.map((r) => Number(r.discountPercent))) : Number(pct),
        productRules: mode === 'PerSku' ? rows.map((r) => ({ productId: r.productId, minimumQuantity: Number(r.minimumQuantity), discountPercent: Number(r.discountPercent) })) : [],
        startAt: `${from}T00:00:00+07:00`, endAt: `${to}T23:59:59.999+07:00`,
        productIds: mode === 'PerSku' ? rows.map((r) => r.productId) : productIds, categoryIds: [], retailerIds, activateOnSave };
      const signature = JSON.stringify(input);
      if (submission.current?.signature !== signature)
        submission.current = { signature, requestId: crypto.randomUUID() };
      const saved = await create.mutateAsync({ ...input, requestId: submission.current.requestId });
      navigate(`/promos/${saved.id}`);
    } catch { /* Keep the form and show the server error. */ }
  };
  return <>
    <PageHeader back="/promos" title="Tạo khuyến mãi" subtitle="Mỗi dòng sản phẩm nhận một chương trình đủ điều kiện có mức giảm cao nhất. Giảm HSD được tính sau khi chọn batch." />
    <Card title="Thông tin chung"><div className="form-grid cols-2">
      <FormField label="Tên chương trình" required><Input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label="Loại chương trình"><Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} options={[{ value: 'PerSku', label: 'Loại 1 · Theo từng SKU' }, { value: 'ProductGroup', label: 'Loại 2 · Theo nhóm sản phẩm' }]} /></FormField>
      <FormField label="Hiệu lực từ" required><Input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
      <FormField label="Hiệu lực đến" required><Input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} /></FormField>
    </div></Card>
    <Card title={mode === 'PerSku' ? 'Loại 1 · Điều kiện riêng cho từng SKU' : 'Loại 2 · Điều kiện theo nhóm sản phẩm'}
      actions={<Button aria-label="Add sản phẩm" onClick={() => setPicker('products')}>Add</Button>}>
      <DataTable urlState={false} title={`Sản phẩm đã thêm · ${selectedProductIds.length}`}
        columns={mode === 'PerSku' ? [...productColumns,
          { key: 'minimumQuantity', header: 'Số lượng tối thiểu', width: '180px', render: p => <Input
            aria-label={`Số lượng tối thiểu ${p.sku}`} type="number" min={1} step={1}
            value={rows.find(r => r.productId === p.id)?.minimumQuantity ?? ''}
            onChange={e => update(p.id, { minimumQuantity: e.target.value })} /> },
          { key: 'discountPercent', header: '% giảm', width: '150px', render: p => <Input
            aria-label={`% giảm ${p.sku}`} type="number" min={1} max={100} step="0.01"
            value={rows.find(r => r.productId === p.id)?.discountPercent ?? ''}
            onChange={e => update(p.id, { discountPercent: e.target.value })} /> },
        ] : productColumns} rows={selectedProducts} rowKey={p => p.id} searchable={false} pageSize={5}
        loading={products.isLoading} error={products.error} emptyText="Chưa thêm sản phẩm. Nhấn Add để tìm kiếm và chọn SKU."
        rowActionsWidth="100px" rowActions={p => <Button size="sm" onClick={() => mode === 'PerSku'
          ? setRows(items => items.filter(r => r.productId !== p.id))
          : setProductIds(ids => ids.filter(id => id !== p.id))}>Bỏ chọn</Button>} />
      {mode === 'PerSku' ? <p className="muted small">Ví dụ SKU001 từ 50 thùng giảm 5%, SKU002 từ 30 thùng giảm 7%. Số lượng của SKU khác không được cộng để đạt ngưỡng.</p> : <>
      <div className="form-grid cols-2" style={{ marginTop: 16 }}>
        <FormField label="Tổng số lượng tối thiểu của nhóm" required><Input type="number" min={1} step={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} /></FormField>
        <FormField label="% giảm chung" required><Input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></FormField>
      </div>
      <p className="muted small">Chỉ cộng số lượng các SKU được chọn trong cùng một đơn. Đạt ngưỡng thì giảm cho từng dòng thuộc nhóm.</p>
      </>}
    </Card>
    {products.isLoading && <Callout>Đang tải sản phẩm…</Callout>}
    {products.error && <Callout tone="danger">{errorMessage(products.error)}</Callout>}
    <Card title="Khách hàng được hưởng ưu đãi" actions={<Button aria-label="Add khách hàng" onClick={() => setPicker('retailers')}>Add</Button>}>
      <p className="muted small">Không chọn cửa hàng nào là áp dụng cho tất cả cửa hàng đủ điều kiện. Đơn đã chốt không tự thay đổi khi kích hoạt khuyến mãi.</p>
      <div className="promo-retailer-picker">
      <DataTable urlState={false} title={`Cửa hàng đã thêm · ${retailerIds.length}`}
        columns={retailerColumns} rows={(retailers.data ?? []).filter((r) => retailerIds.includes(r.id))}
        loading={retailers.isLoading} error={retailers.error}
        rowKey={(r) => r.id} searchable={false} pageSize={5}
        emptyText="Chưa thêm cửa hàng: áp dụng cho tất cả cửa hàng đủ điều kiện."
        rowActionsWidth="100px" rowActions={(r) => <Button size="sm" onClick={() => setRetailerIds((ids) => ids.filter((id) => id !== r.id))}>Bỏ chọn</Button>} />
      </div>
    </Card>
    {picker === 'products' && <PromoSelectionModal title="Chọn sản phẩm áp dụng" rows={prods} columns={productColumns}
      selectedIds={selectedProductIds} rowLabel={p => `${p.sku} · ${p.name}`}
      searchPlaceholder="Tìm mã SKU hoặc tên sản phẩm…" loading={products.isLoading} error={products.error}
      onApply={applyProducts} onCancel={() => setPicker(null)} />}
    {picker === 'retailers' && <PromoSelectionModal title="Chọn khách hàng được hưởng ưu đãi"
      rows={retailers.data?.filter(r => r.status === 'Active')} columns={retailerColumns}
      selectedIds={retailerIds} rowLabel={r => `${r.code} · ${r.name}`}
      searchPlaceholder="Tìm mã, tên, số điện thoại hoặc địa chỉ cửa hàng…" loading={retailers.isLoading} error={retailers.error}
      onApply={ids => { setRetailerIds(ids); setPicker(null); }} onCancel={() => setPicker(null)} />}
    <Callout>Nhập phần trăm được giảm: giảm 10% thì nhập 10. “Mua 10 giảm tiền tương đương 1” tương đương giảm 10%, không phải 90%.</Callout>
    {tried && invalid && <Callout tone="danger">Nhập tên từ 3–200 ký tự, ngày bắt đầu từ hôm nay (giờ Việt Nam) và đầy đủ sản phẩm, số thùng nguyên dương, % giảm từ 1–100. Không chọn trùng SKU.</Callout>}
    {create.error && <Callout tone="danger">{errorMessage(create.error)}</Callout>}
    <div className="row" style={{ justifyContent: 'flex-end' }}><Button onClick={() => navigate('/promos')}>Hủy</Button><Button disabled={create.isPending} onClick={() => submit(false)}>Lưu nháp</Button><Button variant="primary" loading={create.isPending} onClick={() => submit(true)}>Lưu và kích hoạt</Button></div>
  </>;
}
