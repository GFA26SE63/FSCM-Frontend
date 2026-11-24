import { useState } from 'react';
import { Button, Callout, FormField, Input, Modal, Select } from '@/shared/ui';
import { errorMessage } from '@/shared/api/errors';
import { usePromoLookups } from '@/features/promos/hooks';
import { usePublishShelfLife } from '../hooks';
import type { ShelfLifeTier } from '../types';
import { minimumVersionDate } from '@/shared/lib';

const blank = (scope: 'Sku' | 'Category' = 'Sku'): ShelfLifeTier => ({
  scope,
  productId: scope === 'Sku' ? '' : null,
  productCategoryId: scope === 'Category' ? '' : null,
  minRemainingPercent: 0,
  maxRemainingPercent: 20,
  discountType: 'Percent',
  discountValue: 10,
});

export function ShelfLifeDialog({ initial, currentFrom, onClose }: { initial: ShelfLifeTier[]; currentFrom?: string; onClose: () => void }) {
  const { products, categories } = usePromoLookups();
  const publish = usePublishShelfLife();
  const [tiers, setTiers] = useState<ShelfLifeTier[]>(initial.length ? initial.map((tier) => ({ ...tier, id: undefined })) : [blank()]);
  const [date, setDate] = useState(minimumVersionDate(currentFrom));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'All' | 'Sku' | 'Category'>('All');
  const [pickerTarget, setPickerTarget] = useState<{ index: number; scope: 'Sku' | 'Category' } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const allTiers = tiers ?? [];
  const term = (search ?? '').trim().toLowerCase();
  const currentScope = scopeFilter ?? 'All';

  const filteredTiers = allTiers
    .map((tier, originalIndex) => ({ tier, originalIndex }))
    .filter(({ tier }) => {
      if (currentScope !== 'All' && tier.scope !== currentScope) return false;
      if (!term) return true;
      if (tier.scope === 'Sku') {
        const prod = products.data?.find((p) => p.id === tier.productId);
        if (prod) {
          return prod.sku.toLowerCase().includes(term) || prod.name.toLowerCase().includes(term);
        }
        return 'sản phẩm'.includes(term);
      } else {
        const cat = categories.data?.find((c) => c.id === tier.productCategoryId);
        if (cat) {
          return cat.code.toLowerCase().includes(term) || cat.name.toLowerCase().includes(term);
        }
        return 'nhóm hàng'.includes(term);
      }
    });

  const pQuery = (pickerQuery ?? '').trim().toLowerCase();
  const filteredPickerProducts = (products.data ?? [])
    .filter((p) => p.status === 'Published' || (pickerTarget && tiers[pickerTarget.index]?.productId === p.id))
    .filter((p) => !pQuery || p.sku.toLowerCase().includes(pQuery) || p.name.toLowerCase().includes(pQuery));

  const filteredPickerCategories = (categories.data ?? [])
    .filter((c) => !pQuery || c.code.toLowerCase().includes(pQuery) || c.name.toLowerCase().includes(pQuery));

  const update = (index: number, patch: Partial<ShelfLifeTier>) =>
    setTiers((items) => (items ?? []).map((t, i) => i === index ? { ...t, ...patch } : t));

  const save = async () => {
    if (publish.isPending) return;
    if (!date || date < minimumVersionDate(currentFrom)) { setError('Ngày hiệu lực phải từ ngày mai theo giờ Việt Nam và sau phiên bản mới nhất.'); return; }
    if (note.trim().length > 500) { setError('Ghi chú tối đa 500 ký tự.'); return; }
    if (!allTiers.length || allTiers.some((t) => !(t.scope === 'Sku' ? t.productId : t.productCategoryId) ||
      !Number.isFinite(t.minRemainingPercent) || !Number.isFinite(t.maxRemainingPercent) || !Number.isFinite(t.discountValue) ||
      Number(t.minRemainingPercent.toFixed(2)) !== t.minRemainingPercent || Number(t.maxRemainingPercent.toFixed(2)) !== t.maxRemainingPercent ||
      Number(t.discountValue.toFixed(2)) !== t.discountValue || t.discountValue >= 1e16 ||
      t.minRemainingPercent < 0 || t.maxRemainingPercent > 100 || t.maxRemainingPercent <= t.minRemainingPercent ||
      t.discountValue < 0 || (t.discountType === 'Percent' && t.discountValue > 100))) {
      setError('Chọn sản phẩm hoặc nhóm hàng cho mỗi bậc. Khoảng HSD phải nằm trong 0–100%, mức giảm hợp lệ; các giá trị tối đa 2 chữ số thập phân.'); return;
    }
    if (allTiers.some((t, i) => allTiers.slice(i + 1).some((other) => t.scope === other.scope &&
      (t.scope === 'Sku' ? t.productId === other.productId : t.productCategoryId === other.productCategoryId) &&
      t.minRemainingPercent < other.maxRemainingPercent && other.minRemainingPercent < t.maxRemainingPercent))) {
      setError('Các bậc HSD cùng sản phẩm hoặc nhóm hàng không được chồng nhau.'); return;
    }
    setError('');
    try {
      await publish.mutateAsync({ effectiveFrom: new Date(`${date}T00:00:00+07:00`).toISOString(), note: note || undefined, tiers: allTiers });
      onClose();
    } catch { /* Keep inputs and display the mutation error. */ }
  };

  return <Modal open title="Công bố bảng giảm theo HSD" width={1000} onClose={onClose} footer={<>
    <Button disabled={publish.isPending} onClick={onClose}>Hủy</Button><Button variant="primary" loading={publish.isPending} onClick={save}>Công bố</Button>
  </>}>
    <div className="stack-sm">
      <div className="form-grid cols-2">
        <FormField label="Hiệu lực từ" required><Input type="date" min={minimumVersionDate(currentFrom)} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
        <FormField label="Ghi chú"><Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhập ghi chú phiên bản..." /></FormField>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--c-bg-subtle, #f9fafb)', borderRadius: 6, border: '1px solid var(--c-border, #e0e5e2)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, flex: 1, minWidth: 280 }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tìm kiếm sản phẩm / nhóm hàng</label>
            <Input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nhập mã SKU, tên sản phẩm hoặc nhóm hàng..."
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Lọc phạm vi</label>
            <Select
              value={scopeFilter ?? 'All'}
              options={[
                { value: 'All', label: 'Tất cả phạm vi' },
                { value: 'Sku', label: 'Sản phẩm' },
                { value: 'Category', label: 'Nhóm hàng' },
              ]}
              onChange={(e) => setScopeFilter(e.target.value as 'All' | 'Sku' | 'Category')}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Hiển thị <strong>{filteredTiers.length}</strong> / {allTiers.length} bậc
          </span>
          <Button
            variant="primary"
            onClick={() => setTiers((items) => [...(items ?? []), blank(scopeFilter === 'Category' ? 'Category' : 'Sku')])}
          >
            + Thêm bậc giảm
          </Button>
        </div>
      </div>

      <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--c-border, #e0e5e2)', borderRadius: 6 }}>
        <table className="tbl compact auto" style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center' }}>#</th>
              <th style={{ width: 130 }}>Phạm vi</th>
              <th style={{ minWidth: 240 }}>Sản phẩm / Nhóm hàng áp dụng</th>
              <th style={{ width: 200 }}>HSD còn lại (%)</th>
              <th style={{ width: 230 }}>Kiểu &amp; Mức giảm</th>
              <th style={{ width: 70, textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredTiers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 12px', color: '#6b7280' }}>
                  {allTiers.length === 0 ? 'Chưa có bậc giảm giá nào. Nhấn "+ Thêm bậc giảm" để bắt đầu.' : 'Không tìm thấy bậc giảm giá nào phù hợp với bộ lọc / từ khóa.'}
                </td>
              </tr>
            ) : (
              filteredTiers.map(({ tier, originalIndex }) => {
                const selectedProduct = tier.scope === 'Sku' ? products.data?.find((p) => p.id === tier.productId) : null;
                const selectedCategory = tier.scope === 'Category' ? categories.data?.find((c) => c.id === tier.productCategoryId) : null;
                const label = selectedProduct
                  ? `${selectedProduct.sku} · ${selectedProduct.name}`
                  : selectedCategory
                    ? `${selectedCategory.code} · ${selectedCategory.name}`
                    : '';

                return (
                  <tr key={originalIndex}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>
                      {originalIndex + 1}
                    </td>
                    <td>
                      <Select
                        value={tier.scope}
                        options={[{ value: 'Sku', label: 'Sản phẩm' }, { value: 'Category', label: 'Nhóm hàng' }]}
                        onChange={(e) => update(originalIndex, { scope: e.target.value as ShelfLifeTier['scope'], productId: null, productCategoryId: null })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          width: '100%',
                          minHeight: 32,
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: '#ffffff',
                          border: '1px solid var(--c-border, #d1d5db)',
                          borderRadius: 6,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                        onClick={() => {
                          setPickerQuery('');
                          setPickerTarget({ index: originalIndex, scope: tier.scope });
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                          {label || (tier.scope === 'Sku' ? '— Nhấn để chọn sản phẩm —' : '— Nhấn để chọn nhóm hàng —')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--c-primary, #14655B)', fontWeight: 600, marginLeft: 4 }}>Chọn ▾</span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          style={{ width: 56, padding: '4px 6px' }}
                          value={tier.minRemainingPercent}
                          onChange={(e) => update(originalIndex, { minRemainingPercent: e.target.valueAsNumber })}
                        />
                        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>% – &lt;</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          style={{ width: 56, padding: '4px 6px' }}
                          value={tier.maxRemainingPercent}
                          onChange={(e) => update(originalIndex, { maxRemainingPercent: e.target.valueAsNumber })}
                        />
                        <span style={{ fontSize: 12 }}>%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Select
                          style={{ width: 110 }}
                          value={tier.discountType}
                          options={[{ value: 'Percent', label: '% Phần trăm' }, { value: 'FixedPerUnit', label: 'đ / đơn vị' }]}
                          onChange={(e) => update(originalIndex, { discountType: e.target.value as ShelfLifeTier['discountType'] })}
                        />
                        <Input
                          type="number"
                          min={0}
                          style={{ width: 80, padding: '4px 6px' }}
                          value={tier.discountValue}
                          onChange={(e) => update(originalIndex, { discountValue: e.target.valueAsNumber })}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Button
                        size="sm"
                        disabled={allTiers.length === 1}
                        onClick={() => setTiers((items) => (items ?? []).filter((_, j) => originalIndex !== j))}
                      >
                        Xóa
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(error || publish.error || products.error || categories.error) && <Callout tone="danger">{error || errorMessage(publish.error || products.error || categories.error)}</Callout>}

      {pickerTarget && (
        <Modal
          open
          width={720}
          title={pickerTarget.scope === 'Sku' ? 'Chọn sản phẩm áp dụng giảm giá' : 'Chọn nhóm hàng áp dụng giảm giá'}
          subtitle={pickerTarget.scope === 'Sku' ? 'Tìm kiếm nhanh theo mã SKU hoặc tên sản phẩm' : 'Tìm kiếm nhanh theo mã hoặc tên nhóm hàng'}
          onClose={() => setPickerTarget(null)}
          footer={<Button onClick={() => setPickerTarget(null)}>Đóng</Button>}
        >
          <div className="stack-sm">
            <Input
              autoFocus
              value={pickerQuery ?? ''}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder={pickerTarget.scope === 'Sku' ? 'Nhập mã SKU hoặc tên sản phẩm để tìm...' : 'Nhập mã nhóm hoặc tên nhóm hàng để tìm...'}
            />
            <div className="tbl-wrap" style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--c-border, #e0e5e2)', borderRadius: 6 }}>
              {pickerTarget.scope === 'Sku' ? (
                <table className="tbl compact auto" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Mã SKU</th>
                      <th>Tên sản phẩm</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPickerProducts.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '24px 12px', color: '#6b7280' }}>
                          Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredPickerProducts.map((p) => {
                        const isSelected = tiers[pickerTarget.index]?.productId === p.id;
                        return (
                          <tr
                            key={p.id}
                            className={isSelected ? 'selected clickable' : 'clickable'}
                            onClick={() => {
                              update(pickerTarget.index, { productId: p.id });
                              setPickerTarget(null);
                            }}
                          >
                            <td><strong>{p.sku}</strong></td>
                            <td>{p.name}</td>
                            <td style={{ textAlign: 'center' }}>
                              <Button
                                size="sm"
                                variant={isSelected ? 'primary' : 'default'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  update(pickerTarget.index, { productId: p.id });
                                  setPickerTarget(null);
                                }}
                              >
                                {isSelected ? 'Đang chọn' : 'Chọn'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="tbl compact auto" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Mã nhóm</th>
                      <th>Tên nhóm hàng</th>
                      <th style={{ width: 90, textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPickerCategories.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '24px 12px', color: '#6b7280' }}>
                          Không tìm thấy nhóm hàng nào khớp với từ khóa tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredPickerCategories.map((c) => {
                        const isSelected = tiers[pickerTarget.index]?.productCategoryId === c.id;
                        return (
                          <tr
                            key={c.id}
                            className={isSelected ? 'selected clickable' : 'clickable'}
                            onClick={() => {
                              update(pickerTarget.index, { productCategoryId: c.id });
                              setPickerTarget(null);
                            }}
                          >
                            <td><strong>{c.code}</strong></td>
                            <td>{c.name}</td>
                            <td style={{ textAlign: 'center' }}>
                              <Button
                                size="sm"
                                variant={isSelected ? 'primary' : 'default'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  update(pickerTarget.index, { productCategoryId: c.id });
                                  setPickerTarget(null);
                                }}
                              >
                                {isSelected ? 'Đang chọn' : 'Chọn'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  </Modal>;
}
