import { Callout, FormDialog, Modal, type FormFieldDef } from '@/shared/ui';
import { ApiError } from '@/shared/api/errors';
import type { CategoryOption, Product } from '@/features/products/types';
import { useSetMlor } from '../hooks';
import { retailerApi } from '../api';
import type { MlorConfigItem } from '../types';

export function MlorRuleDialog({ retailerId, scope, config, configs, categories, products, onClose }: {
  retailerId: string;
  scope: 'category' | 'product';
  config?: MlorConfigItem;
  configs: MlorConfigItem[];
  categories: CategoryOption[];
  products: Product[];
  onClose: () => void;
}) {
  const save = useSetMlor(retailerId);
  const category = scope === 'category';
  const scopeKey = category ? 'productCategoryId' : 'productId';
  const occupied = new Set(configs.filter(rule => rule.isActive).map(rule => rule[scopeKey]));
  const availableCategories = categories.filter(item => !occupied.has(item.id));
  const availableProducts = products.filter(item => !occupied.has(item.id));
  const options = category
    ? availableCategories.map(c => ({ value: c.id, label: `${c.code} · ${c.name}` }))
    : availableProducts.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` }));

  if (!config && options.length === 0) return <Modal open width={560} title="Thêm yêu cầu HSD" onClose={onClose}>
    <Callout tone="info">Không còn {category ? 'danh mục' : 'sản phẩm'} chưa có yêu cầu HSD để thêm.
      Với dòng đã có trong danh sách, hãy dùng nút Sửa.</Callout>
  </Modal>;

  const fields: FormFieldDef[] = [
    config ? {
      key: scopeKey, type: 'info', label: category ? 'Danh mục' : 'Sản phẩm',
      info: () => category
        ? `${config.categoryCode ?? ''} · ${config.categoryName ?? ''}`
        : `${config.productSku ?? ''} · ${config.productName ?? ''}`,
    } : {
      key: scopeKey, type: 'select', required: true,
      label: category ? 'Danh mục sản phẩm' : 'Sản phẩm (SKU)',
      options,
      validate: value => occupied.has(String(value))
        ? 'Đã có yêu cầu HSD cho lựa chọn này. Hãy dùng nút Sửa ở dòng tương ứng.' : undefined,
    },
    {
      key: 'ratioPercent', label: 'Tỷ lệ HSD tối thiểu (%)', type: 'number', required: true, step: 'any',
      validate: value => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) < 100
        ? undefined : 'Tỷ lệ phải lớn hơn 0% và nhỏ hơn 100%.',
    },
    ...(!category ? [{
      key: 'minimumLifeHours', label: 'HSD tối thiểu (giờ, tùy chọn)', type: 'number' as const,
      placeholder: 'Để trống nếu chỉ dùng tỷ lệ %',
      validate: (value: unknown, values: Record<string, unknown>) => {
        const hours = Number(value);
        if (!Number.isInteger(hours) || hours < 0) return 'Số giờ phải là số nguyên không âm.';
        const product = products.find(p => p.id === (config?.productId ?? values.productId));
        return product && hours > product.shelfLifeHours
          ? `Không vượt quá hạn dùng sản phẩm (${product.shelfLifeHours} giờ).` : undefined;
      },
    }] : []),
  ];

  return <FormDialog
    open width={560} columns={1}
    title={`${config ? 'Sửa' : 'Thêm'} yêu cầu HSD theo ${category ? 'danh mục' : 'sản phẩm'}`}
    fields={fields}
    initial={{
      [scopeKey]: config?.[scopeKey] ?? options[0]?.value ?? '',
      ratioPercent: config ? String(config.minimumLifeRatio * 100) : category ? '50' : '60',
      minimumLifeHours: config?.minimumLifeHours == null ? '' : String(config.minimumLifeHours),
    }}
    submitLabel={config ? 'Lưu thay đổi' : 'Lưu cấu hình'} onClose={onClose}
    onSubmit={async values => {
      // Keep the original scope when editing; POST replaces its active rule and retains history.
      const id = config?.[scopeKey] ?? String(values[scopeKey]);
      if (!config) {
        const latest = await retailerApi.mlorConfigs(retailerId);
        if (latest.some(rule => rule.isActive && rule[scopeKey] === id)) {
          throw new ApiError(409, 'Yêu cầu HSD đã tồn tại.',
            'Danh mục hoặc sản phẩm này đã có yêu cầu HSD. Hãy đóng form Thêm và dùng nút Sửa ở dòng tương ứng.');
        }
      }
      await save.mutateAsync({
        retailerId, [scopeKey]: id,
        minimumLifeRatio: Number(values.ratioPercent) / 100,
        minimumLifeHours: category || values.minimumLifeHours === '' || values.minimumLifeHours == null
          ? null : Number(values.minimumLifeHours),
      });
      onClose();
    }}
  />;
}
