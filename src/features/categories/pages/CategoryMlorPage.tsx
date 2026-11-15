import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/shared/api/http';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, Callout, Chip, DataTable, FormDialog, PageHeader, type Column } from '@/shared/ui';
import { formatDate } from '@/shared/lib';
import { useApiMutation } from '@/shared/hooks';
import { categoryApi } from '../api';
import { useCategories } from '../hooks';
import { getCategoryPath } from '../treeUtils';
import type { Category } from '../types';

type Effective = { ratio: number | null; source: 'own' | 'parent' | 'system'; from?: Category };

const pct = (ratio: number | null | undefined) =>
  ratio == null ? '—' : `${Number((ratio * 100).toFixed(2))}%`;

/** Walks up the tree: own value → nearest ancestor with a value → system default. */
function effectiveOf(cat: Category, byId: Map<string, Category>, systemRatio: number | null): Effective {
  const visited = new Set<string>();
  let current: Category | undefined = cat;
  while (current?.id && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.defaultMlorRatio != null)
      return { ratio: current.defaultMlorRatio, source: current === cat ? 'own' : 'parent', from: current };
    current = current.parentCategoryId ? byId.get(current.parentCategoryId.toLowerCase()) : undefined;
  }
  return { ratio: systemRatio, source: 'system' };
}

/**
 * "MLOR theo danh mục sản phẩm": category-level default MLOR. When a Sales order line has no
 * retailer SKU/Category MLOR rule, the backend uses this value (nearest ancestor), then the
 * system default `mlor.default_ratio`.
 */
export function CategoryMlorPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const query = useCategories(true);
  const system = useQuery({
    queryKey: ['configurations', 'mlor.default_ratio'],
    queryFn: async () => {
      const rows = await get<{ key: string; value: unknown }[]>('/configurations');
      const raw = rows.find((r) => r.key === 'mlor.default_ratio')?.value;
      return raw == null ? null : Number(raw);
    },
  });
  const [editing, setEditing] = useState<Category | null>(null);
  const save = useApiMutation(
    ({ id, ratio }: { id: string; ratio: number | null }) => categoryApi.setDefaultMlor(id, ratio),
    { success: (c) => `Đã cập nhật MLOR mặc định cho ${c.code}.` },
  );

  const categories = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(
    () => new Map(categories.filter((c) => c.id).map((c) => [c.id!.toLowerCase(), c])),
    [categories],
  );
  const systemRatio = system.data ?? null;

  const columns: Column<Category>[] = [
    { key: 'code', header: 'Mã', width: '110px', text: (c) => c.code },
    { key: 'path', header: 'Danh mục', text: (c) => getCategoryPath(categories, c) || c.name },
    {
      key: 'own',
      header: 'MLOR riêng của danh mục',
      width: '190px',
      text: (c) => (c.defaultMlorRatio != null ? pct(c.defaultMlorRatio) : 'Chưa đặt'),
    },
    {
      key: 'effective',
      header: 'MLOR đang áp dụng',
      width: '260px',
      render: (c) => {
        const e = effectiveOf(c, byId, systemRatio);
        return (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <b>{pct(e.ratio)}</b>
            {e.source === 'own' && <Chip tone="ok">Theo danh mục</Chip>}
            {e.source === 'parent' && <Chip tone="info">Kế thừa {e.from?.code}</Chip>}
            {e.source === 'system' && <Chip tone="warn">Mặc định hệ thống</Chip>}
          </span>
        );
      },
    },
    {
      key: 'updated',
      header: 'Cập nhật',
      width: '120px',
      text: (c) => (c.defaultMlorUpdatedAt ? formatDate(c.defaultMlorUpdatedAt) : '—'),
    },
  ];

  return (
    <>
      <PageHeader
        title="MLOR theo danh mục sản phẩm"
        subtitle="Tỷ lệ hạn sử dụng còn lại tối thiểu mặc định cho từng danh mục sản phẩm."
      />
      <Callout tone="info">
        Thứ tự áp dụng khi Sales đặt hàng: MLOR riêng của retailer theo SKU → MLOR riêng của retailer theo danh mục →
        MLOR theo danh mục sản phẩm (danh mục gần nhất có cấu hình, kể cả danh mục cha) → MLOR mặc định hệ thống
        ({pct(systemRatio)}). Thay đổi chỉ áp dụng cho đơn tạo mới.
      </Callout>
      <DataTable
        title="Danh mục sản phẩm"
        rows={categories}
        loading={query.isLoading}
        error={query.error}
        rowKey={(c) => c.id || c.code}
        columns={columns}
        searchPlaceholder="Mã, tên danh mục..."
        rowActionHeader="Thao tác"
        rowActionsWidth="120px"
        rowActions={(c) =>
          isAdmin && c.id ? (
            <Button size="sm" variant="primary" onClick={() => setEditing(c)}>
              Đặt MLOR
            </Button>
          ) : null
        }
      />
      {editing && (
        <FormDialog
          open
          width={520}
          columns={1}
          title={`MLOR mặc định · ${editing.code} · ${editing.name}`}
          subtitle="Để trống để bỏ cấu hình, danh mục sẽ kế thừa danh mục cha hoặc MLOR mặc định hệ thống."
          submitLabel="Lưu"
          initial={{ percent: editing.defaultMlorRatio != null ? String(Number((editing.defaultMlorRatio * 100).toFixed(3))) : '' }}
          fields={[
            {
              key: 'percent',
              type: 'number',
              label: 'MLOR tối thiểu (%)',
              step: 'any',
              placeholder: `VD: 30 (mặc định hệ thống ${pct(systemRatio)})`,
              hint: 'Phần trăm hạn sử dụng còn lại tối thiểu khi giao, lớn hơn 0 và nhỏ hơn 100.',
              validate: (v) => {
                const n = Number(String(v).replace(',', '.'));
                return n > 0 && n < 100 ? undefined : 'Giá trị phải lớn hơn 0 và nhỏ hơn 100.';
              },
            },
          ]}
          onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            const raw = String(v.percent ?? '').trim();
            const ratio = raw === '' ? null : Number(raw.replace(',', '.')) / 100;
            await save.mutateAsync({ id: editing.id!, ratio });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
