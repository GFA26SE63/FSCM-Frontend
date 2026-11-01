import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, Card, Fields, PageHeader, QueryState, SimpleTable, StatusChip } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useCategory } from '../hooks';
import { CategoryDialog } from '../components/CategoryDialog';

export function CategoryDetailPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const query = useCategory(code);
  const [edit, setEdit] = useState(false);

  return (
    <QueryState query={query}>
      {(c) => (
        <>
          <PageHeader
            back="/cats"
            title={`${c.code} · ${c.name}`}
            chips={<StatusChip domain="active" value={c.status} />}
            actions={isAdmin ? <Button onClick={() => setEdit(true)}>Sửa</Button> : undefined}
          />
          <Card>
            <Fields
              items={[
                { label: 'Mã danh mục', value: c.code },
                { label: 'Tên danh mục', value: c.name },
                { label: 'Mô tả', value: c.description || '—' },
                { label: 'Số sản phẩm', value: `${c.products?.length ?? c.productCount ?? 0} sản phẩm` },
              ]}
            />
          </Card>
          <Card title="Sản phẩm trong danh mục" flush>
            <SimpleTable
              rows={c.products}
              empty="Danh mục chưa có sản phẩm."
              columns={[
                {
                  header: 'SKU',
                  cell: (p) => (
                    <a
                      href={`/skus/${p.sku}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/skus/${p.sku}`);
                      }}
                    >
                      {p.sku}
                    </a>
                  ),
                },
                { header: 'Tên', cell: (p) => p.name },
                { header: 'Quy cách', cell: (p) => p.packSpec },
                { header: 'Giá', align: 'right', cell: (p) => formatMoney(p.basePrice) },
                { header: 'Trạng thái', cell: (p) => <StatusChip domain="product" value={p.status} /> },
              ]}
            />
          </Card>
          <CategoryDialog open={edit} category={c} onClose={() => setEdit(false)} />
        </>
      )}
    </QueryState>
  );
}

