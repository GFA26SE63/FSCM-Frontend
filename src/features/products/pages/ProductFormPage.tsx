import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { assertPermission, can } from '@/shared/auth/permissions';
import { useNavigate, useParams } from '@/shared/router/compat';
import { Button, Callout, Card, FormField, Input, PageHeader, QueryState, Select } from '@/shared/ui';
import { useCategoryOptions, useCreateProduct, useCreateReplacement, useProduct, useSaveProductDraft } from '../hooks';
import { dayError, daysToHours, numberValue, priceError, productFormError, skuError } from '../utils';
import type { CategoryOption, Product } from '../types';

type Mode = 'create' | 'edit' | 'replacement';

export const ProductCreatePage = () => <ProductFormPage mode="create" />;
export const ProductEditPage = () => <ProductFormPage mode="edit" />;
export const ProductReplacementPage = () => <ProductFormPage mode="replacement" />;

function ProductFormPage({ mode }: { mode: Mode }) {
  const { sku = '' } = useParams();
  const { user } = useAuth();
  const product = useProduct(mode === 'create' ? '' : sku);
  const categories = useCategoryOptions(can(user, 'products.manage'));
  const navigate = useNavigate();
  if (!can(user, 'products.manage')) return <Callout tone="danger">403 — Không có quyền quản lý sản phẩm.</Callout>;
  const render = (source?: Product) => <QueryState query={categories}>{(items) => (
    <ProductEditor key={mode + (source?.id ?? '')} mode={mode} product={source} categories={items} />
  )}</QueryState>;
  return <>
    {(product.error || categories.error) && <div className="row-wrap">
      <Button onClick={() => navigate('/skus')}>Về danh sách</Button>
      <Button onClick={() => { if (mode !== 'create') void product.refetch(); void categories.refetch(); }}>Thử lại</Button>
    </div>}
    {mode === 'create' ? render() : <QueryState query={product}>{(p) => render(p)}</QueryState>}
  </>;
}

function ProductEditor({ mode, product, categories }: {
  mode: Mode; product?: Product; categories: CategoryOption[];
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const create = useCreateProduct();
  const replace = useCreateReplacement();
  const save = useSaveProductDraft();
  const lock = useRef(false);
  const [values, setValues] = useState({
    sku: mode === 'edit' ? product?.sku ?? '' : '',
    productCategoryId: product?.productCategoryId ?? categories.find((c) => c.isActive)?.id ?? '',
    name: product?.name ?? '', unit: product?.unit ?? 'Thùng',
    shelfLifeDays: product ? String(product.shelfLifeHours / 24) : '',
    nearDateDays: product ? String(product.nearDateThresholdHours / 24) : '',
    unitPrice: product?.currentUnitPrice == null ? '' : String(product.currentUnitPrice),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const busy = create.isPending || replace.isPending || save.isPending;
  const back = product ? '/skus/' + product.id : '/skus';
  const title = mode === 'create' ? 'Thêm sản phẩm (bản nháp)' :
    mode === 'edit' ? 'Sửa bản nháp ' + product?.sku : 'Tạo bản mới từ ' + product?.sku;
  const blocked = (mode === 'edit' && product?.status !== 'Draft') ||
    (mode === 'replacement' && product?.status !== 'Published');
  const set = (key: keyof typeof values, value: string) => {
    setValues((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: '' }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (lock.current || blocked) return;
    const next: Record<string, string> = {};
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      if (!values[key].trim()) next[key] = 'Bắt buộc nhập.';
    }
    const invalidSku = skuError(values.sku);
    if (invalidSku) next.sku = invalidSku;
    if (mode === 'replacement' && values.sku.trim().toUpperCase() === product?.sku) next.sku = 'SKU mới phải khác SKU nguồn.';
    if (values.name.trim().length > 200) next.name = 'Tối đa 200 ký tự.';
    if (values.unit.trim().length > 50) next.unit = 'Tối đa 50 ký tự.';
    if (!categories.some((c) => c.id === values.productCategoryId && c.isActive)) next.productCategoryId = 'Chọn danh mục đang hoạt động.';
    const life = dayError(values.shelfLifeDays);
    const near = dayError(values.nearDateDays, true);
    const price = priceError(values.unitPrice);
    if (life) next.shelfLifeDays = life;
    if (near) next.nearDateDays = near;
    if (numberValue(values.nearDateDays) >= numberValue(values.shelfLifeDays)) next.nearDateDays = 'Phải nhỏ hơn tổng hạn dùng.';
    if (price) next.unitPrice = price;
    setErrors(next);
    if (Object.keys(next).length) return;
    lock.current = true;
    setFailure('');
    try {
      assertPermission(user, 'products.manage');
      const fields = {
        productCategoryId: values.productCategoryId, name: values.name.trim(), unit: values.unit.trim(),
        shelfLifeHours: daysToHours(values.shelfLifeDays), nearDateThresholdHours: daysToHours(values.nearDateDays),
      };
      let saved: Product;
      if (mode === 'edit') {
        saved = await save.mutateAsync({ id: product!.id, ...fields, unitPrice: numberValue(values.unitPrice) });
      } else {
        const input = { ...fields, sku: values.sku.trim().toUpperCase(), initialUnitPrice: numberValue(values.unitPrice) };
        if (mode === 'replacement') {
          saved = await replace.mutateAsync({
            id: product!.id, sku: input.sku, name: input.name, unit: input.unit,
            shelfLifeHours: input.shelfLifeHours, nearDateThresholdHours: input.nearDateThresholdHours,
            initialUnitPrice: input.initialUnitPrice,
          });
        } else saved = await create.mutateAsync(input);
      }
      navigate('/skus/' + saved.id);
    } catch (error) {
      const apiError = productFormError(error);
      setFailure(apiError.detail ?? apiError.title);
      const fieldErrors: Record<string, string> = {};
      for (const key of Object.keys(values)) {
        const message = apiError.field(key) || (key === 'unitPrice' ? apiError.field('initialUnitPrice') : undefined);
        if (message) fieldErrors[key] = message;
      }
      setErrors(fieldErrors);
      void client.invalidateQueries({ queryKey: ['products'] });
    } finally { lock.current = false; }
  };

  return <>
    <PageHeader back={back} title={title} subtitle="Sản phẩm (SKU) · Lưu ở trạng thái Nháp" />
    {blocked ? <Callout tone="danger">Không thể mở form này với trạng thái hiện tại. Thông tin và giá đã đăng bán được khóa trên Portal.</Callout> : (
      <form onSubmit={(event) => void submit(event)} noValidate className="stack">
        {failure && <div className="callout callout-danger" role="alert">{failure}</div>}
        {mode === 'replacement' && <Callout tone="info">Điền sẵn từ {product?.sku}. Bản nguồn vẫn đang bán; khi đăng bán bản mới, bản nguồn sẽ ngừng bán. Danh mục được kế thừa từ bản nguồn.</Callout>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <Card title="Thông tin sản phẩm">
            <div className="form-grid cols-2">
              <FormField label="SKU" required error={errors.sku} hint={mode === 'edit' ? 'SKU giữ cố định.' : 'Nhập mã mới, ví dụ SKU099.'}>
                <Input value={values.sku} readOnly={mode === 'edit'} onChange={(e) => set('sku', e.target.value)} />
              </FormField>
              <FormField label="Danh mục" required error={errors.productCategoryId}>
                <Select value={values.productCategoryId} disabled={mode === 'replacement'}
                  options={categories.filter((c) => c.isActive || c.id === values.productCategoryId).map((c) => ({
                    value: c.id, label: c.code + ' · ' + c.name + (c.isActive ? '' : ' (ngừng hoạt động)'), disabled: !c.isActive,
                  }))} onChange={(e) => set('productCategoryId', e.target.value)} />
              </FormField>
              <FormField label="Tên sản phẩm" required span={2} error={errors.name}>
                <Input value={values.name} maxLength={200} onChange={(e) => set('name', e.target.value)} />
              </FormField>
              <FormField label="Đơn vị bán" required error={errors.unit}>
                <Input value={values.unit} maxLength={50} onChange={(e) => set('unit', e.target.value)} />
              </FormField>
              <FormField label="Giá bán / đơn vị (đ)" required error={errors.unitPrice}>
                <Input inputMode="decimal" value={values.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} />
              </FormField>
            </div>
          </Card>
          <Card title="Hạn dùng">
            <div className="form-grid cols-2">
              <FormField label="Tổng hạn dùng (ngày)" required error={errors.shelfLifeDays} hint="Ví dụ 1,5 ngày = 36 giờ.">
                <Input inputMode="decimal" value={values.shelfLifeDays} onChange={(e) => set('shelfLifeDays', e.target.value)} />
              </FormField>
              <FormField label="Cận hạn khi còn (ngày)" required error={errors.nearDateDays}>
                <Input inputMode="decimal" value={values.nearDateDays} onChange={(e) => set('nearDateDays', e.target.value)} />
              </FormField>
            </div>
          </Card>
        </fieldset>
        <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
          <Button disabled={busy} onClick={() => { if (!lock.current) navigate(back); }}>Hủy</Button>
          <Button type="submit" variant="primary" loading={busy}>Lưu nháp</Button>
        </div>
      </form>
    )}
  </>;
}
