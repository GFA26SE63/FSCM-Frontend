import { useState } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { Button, Callout, Card, Checkbox, FormField, Input, PageHeader } from '@/shared/ui';
import { addDays, toIsoDate } from '@/shared/lib';
import { useCreatePromo, usePromoLookups } from '../hooks';

/**
 * "Tạo khuyến mãi": one minimum quantity and one percentage, applied to the SKUs, categories and
 * retailers named here.
 *
 * The form used to offer a different percentage per SKU inside one programme. The server has no
 * such shape, so nothing typed into it could be saved. Several percentages are several programmes,
 * which matches the pricing rule anyway: a line takes the single best promotion, never a sum.
 */
export function PromoFormPage() {
  const navigate = useNavigate();
  const { products, categories, retailers } = usePromoLookups();
  const create = useCreatePromo();
  const today = toIsoDate(new Date());
  const [name, setName] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [minQty, setMinQty] = useState('');
  const [pct, setPct] = useState('');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [retailerIds, setRetailerIds] = useState<string[]>([]);
  const [tried, setTried] = useState(false);

  const prods = (products.data ?? []).filter((p) => p.status === 'Published');
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Bắt buộc nhập.';
  if (to < from) errors.to = 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (!(Number(minQty) > 0)) errors.minQty = 'Phải lớn hơn 0.';
  if (!(Number(pct) > 0 && Number(pct) < 100)) errors.pct = '% giảm phải trong khoảng (0, 100).';
  // A promotion that names nothing would apply to nothing; the server would accept it silently.
  if (productIds.length === 0 && categoryIds.length === 0) {
    errors.scope = 'Chọn ít nhất một SKU hoặc một nhóm hàng, nếu không chương trình không áp dụng cho gì cả.';
  }
  const bad = Object.keys(errors).length > 0;

  const toggle = (list: string[], set: (v: string[]) => void, v: string, on: boolean) =>
    set(on ? [...list, v] : list.filter((x) => x !== v));

  const submit = async () => {
    setTried(true);
    if (bad) return;
    const p = await create.mutateAsync({
      name,
      minimumQuantity: Number(minQty),
      discountPercent: Number(pct),
      startAt: from,
      endAt: to,
      productIds,
      categoryIds,
      retailerIds,
    });
    navigate(`/promos/${p.id}`);
  };

  return (
    <>
      <PageHeader
        back="/promos"
        title="Tạo khuyến mãi"
        subtitle="Mã KM-xxx do hệ thống cấp. Một chương trình = một mức giảm cho một lượng mua tối thiểu; muốn nhiều mức thì tạo nhiều chương trình."
      />
      <Card title="Thông tin chung">
        <div className="form-grid">
          <FormField label="Tên chương trình" required error={tried ? errors.name : null} span={3}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Mua nhiều giảm sâu tháng 10" />
          </FormField>
          <FormField label="Hiệu lực từ"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
          <FormField label="Hiệu lực đến" error={tried ? errors.to : null}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </FormField>
        </div>
      </Card>

      <Card title="Mức giảm">
        <div className="form-grid cols-2">
          <FormField label="Mua tối thiểu (thùng)" required error={tried ? errors.minQty : null}>
            <Input inputMode="numeric" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          </FormField>
          <FormField label="% giảm" required error={tried ? errors.pct : null}>
            <Input inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value)} />
          </FormField>
        </div>
      </Card>

      <Card title="Áp dụng cho SKU">
        <div className="row-wrap">
          {prods.map((p) => (
            <Checkbox
              key={p.id}
              label={`${p.sku} · ${p.name}`}
              checked={productIds.includes(p.id)}
              onChange={(v) => toggle(productIds, setProductIds, p.id, v)}
            />
          ))}
        </div>
      </Card>

      <Card title="Hoặc cả nhóm hàng">
        <div className="stack-sm">
          <span className="muted small">Chọn nhóm là áp dụng cho mọi SKU đang thuộc nhóm đó.</span>
          <div className="row-wrap">
            {(categories.data ?? []).map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={categoryIds.includes(c.id)}
                onChange={(v) => toggle(categoryIds, setCategoryIds, c.id, v)}
              />
            ))}
          </div>
          {tried && errors.scope && <Callout tone="danger">{errors.scope}</Callout>}
        </div>
      </Card>

      <Card title="Khách hàng áp dụng">
        <div className="stack-sm">
          <span className="muted small">Không chọn retailer nào = áp dụng cho tất cả.</span>
          <div className="row-wrap">
            {(retailers.data ?? [])
              .filter((r) => r.status === 'Active')
              .map((r) => (
                <Checkbox
                  key={r.id}
                  label={`${r.name} (${r.code})`}
                  checked={retailerIds.includes(r.id)}
                  onChange={(v) => toggle(retailerIds, setRetailerIds, r.id, v)}
                />
              ))}
          </div>
        </div>
      </Card>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button onClick={() => navigate('/promos')}>Hủy</Button>
        <Button variant="primary" loading={create.isPending} onClick={submit}>Tạo khuyến mãi</Button>
      </div>
    </>
  );
}
