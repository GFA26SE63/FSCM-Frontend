import { useState, useMemo } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { Button, DataTable, PageHeader, StatusChip, SimpleTable, Chip, Card, type Column } from '@/shared/ui';
import { statusLabels, formatMoney } from '@/shared/lib';
import { useCategories, useCategory } from '../hooks';
import { CategoryDialog } from '../components/CategoryDialog';
import type { Category } from '../types';

export function CategoriesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const query = useCategories();
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [searchTree, setSearchTree] = useState('');
  const [dlg, setDlg] = useState<{ category: Category | null } | null>(null);

  const categories = useMemo(() => query.data ?? [], [query.data]);

  // Default selection
  const activeCode = selectedCode || (categories[0]?.code ?? '');
  const detailQuery = useCategory(activeCode);

  const filteredTree = useMemo(() => {
    if (!searchTree.trim()) return categories;
    const q = searchTree.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [categories, searchTree]);

  const selectedCat = categories.find((c) => c.code === activeCode) || categories[0];

  const columns: Column<Category>[] = [
    { key: 'code', header: 'Mã', width: '100px', render: (c) => <span className="bold">{c.code}</span> },
    { key: 'name', header: 'Tên danh mục', width: '220px' },
    { key: 'description', header: 'Mô tả' },
    {
      key: 'count',
      header: 'Số SKU',
      width: '90px',
      align: 'right',
      render: (c) => {
        const count =
          (c.code === detailQuery.data?.code && detailQuery.data?.products
            ? detailQuery.data.products.length
            : c.productCount) ?? 0;
        return <span>{count}</span>;
      },
      text: (c) =>
        (c.code === detailQuery.data?.code && detailQuery.data?.products
          ? detailQuery.data.products.length
          : c.productCount) ?? 0,
    },
    { key: 'status', header: 'Trạng thái', width: '120px', render: (c) => <StatusChip domain="active" value={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Danh mục sản phẩm"
        subtitle="Cây danh mục phân cấp cho các SKU sản phẩm."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="sm"
              variant={viewMode === 'tree' ? 'primary' : 'default'}
              onClick={() => setViewMode('tree')}
            >
              Dạng cây
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >
              Dạng bảng
            </Button>
            {isAdmin && <Button variant="primary" onClick={() => setDlg({ category: null })}>+ Danh mục gốc</Button>}
          </div>
        }
      />

      {viewMode === 'tree' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 16 }}>
          {/* Left panel: Category Tree */}
          <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderBottom: '1px solid #E2E5E0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>
                  Cây danh mục <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {categories.length} danh mục</span>
                </span>
                {isAdmin && (
                  <Button size="sm" variant="primary" onClick={() => setDlg({ category: null })}>
                    + Thêm
                  </Button>
                )}
              </div>
              <input
                className="inp"
                placeholder="Tìm danh mục…"
                aria-label="Tìm danh mục"
                value={searchTree}
                onChange={(e) => setSearchTree(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }} role="tree">
              {filteredTree.map((c) => {
                const isSelected = c.code === activeCode;
                const count = (isSelected && detailQuery.data?.products ? detailQuery.data.products.length : c.productCount) ?? 0;
                return (
                  <button
                    key={c.code}
                    role="treeitem"
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: isSelected ? '#E1F1EC' : 'transparent',
                      color: isSelected ? '#14655B' : '#1B1F1D',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      fontSize: 13.5,
                      marginBottom: 2,
                    }}
                    onClick={() => setSelectedCode(c.code)}
                  >
                    <span style={{ color: 'var(--c-primary)', fontSize: 12 }}>▸</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <Chip tone="neutral">{count} SP</Chip>
                  </button>
                );
              })}
              {filteredTree.length === 0 && (
                <p className="muted" style={{ textAlign: 'center', padding: 20, margin: 0, fontSize: 13 }}>
                  Không tìm thấy danh mục.
                </p>
              )}
            </div>
          </section>

          {/* Right panel: Selected category details and products table */}
          <div style={{ minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {selectedCat ? (
              <>
                <Card style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="muted" style={{ fontSize: 12.5 }}>Danh mục gốc / {selectedCat.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 18 }}>{selectedCat.name}</span>
                        <StatusChip domain="active" value={selectedCat.status} />
                      </div>
                    </div>
                    {isAdmin && (
                      <Button size="sm" onClick={() => setDlg({ category: selectedCat })}>
                        Sửa
                      </Button>
                    )}
                    <Button size="sm" variant="primary" onClick={() => navigate(`/cats/${selectedCat.code}`)}>
                      Xem chi tiết
                    </Button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '14px 32px' }}>
                    <div className="fv">
                      <span className="fl">Mã danh mục</span>
                      <span className="fval">{selectedCat.code}</span>
                    </div>
                    <div className="fv">
                      <span className="fl">Cấp</span>
                      <span className="fval">Cấp 1 (Gốc)</span>
                    </div>
                    <div className="fv">
                      <span className="fl">Mô tả</span>
                      <span className="fval">{selectedCat.description || '—'}</span>
                    </div>
                  </div>
                </Card>

                <Card
                  title="Sản phẩm trong nhánh này (gồm danh mục con)"
                  actions={
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {(detailQuery.data?.products?.length ?? selectedCat.productCount) ?? 0} sản phẩm
                    </span>
                  }
                >
                  {detailQuery.isLoading ? (
                    <div className="loading"><span className="spinner" /> Đang tải sản phẩm…</div>
                  ) : (
                    <SimpleTable
                      rows={detailQuery.data?.products ?? []}
                      empty="Chưa có sản phẩm. Sản phẩm được gán vào danh mục ở màn Sản phẩm (SKU)."
                      columns={[
                        {
                          header: 'SKU',
                          width: '100px',
                          cell: (p) => (
                            <a
                              href={`/skus/${p.sku}`}
                              style={{ fontWeight: 600 }}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/skus/${p.sku}`);
                              }}
                            >
                              {p.sku}
                            </a>
                          ),
                        },
                        { header: 'Tên sản phẩm', cell: (p) => p.name },
                        { header: 'Quy cách', width: '130px', cell: (p) => p.packSpec },
                        { header: 'Giá bán', width: '130px', align: 'right', cell: (p) => formatMoney(p.basePrice) },
                        { header: 'Trạng thái', width: '120px', cell: (p) => <StatusChip domain="product" value={p.status} /> },
                      ]}
                    />
                  )}
                </Card>
              </>
            ) : (
              <Card>
                <div className="empty">
                  <div className="empty-title">Chọn một danh mục bên trái</div>
                  <div className="empty-desc">Chọn danh mục từ cây để xem chi tiết và danh sách sản phẩm.</div>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <DataTable
          title="Danh mục"
          rows={query.data}
          loading={query.isLoading}
          error={query.error}
          rowKey={(c) => c.code}
          columns={columns}
          searchPlaceholder="Mã, tên, mô tả…"
          filters={[{ label: 'Trạng thái', options: [statusLabels.active.Active, statusLabels.active.Inactive], value: (c) => statusLabels.active[c.status] }]}
          actions={isAdmin ? <Button variant="primary" onClick={() => setDlg({ category: null })}>+ Thêm danh mục</Button> : undefined}
          onRowClick={(c) => navigate(`/cats/${c.code}`)}
          rowActionsWidth="150px"
          rowActions={(c) => (
            <>
              <Button size="sm" onClick={() => navigate(`/cats/${c.code}`)}>Xem</Button>
              {isAdmin && <Button size="sm" onClick={() => setDlg({ category: c })}>Sửa</Button>}
            </>
          )}
        />
      )}

      <CategoryDialog open={!!dlg} category={dlg?.category} onClose={() => setDlg(null)} />
    </>
  );
}
