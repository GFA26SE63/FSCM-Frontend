import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { ConfirmDialog, Modal, Button } from '@/shared/ui';
import { formatMoney } from '@/shared/lib';
import { useToast } from '@/shared/ui/Toast';
import { useCategories, useCategory, useUpdateCategoryStatus, useDeleteCategory } from '../hooks';
import { CategoryDialog } from '../components/CategoryDialog';
import type { Category } from '../types';
import {
  findCategory,
  getCategoryDepth,
  getCategoryPath,
  getCategoryChildren,
  canAddSubcategory,
  buildFlatTree,
} from '../treeUtils';

export function CategoriesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isOperator = user?.role === 'Operator';
  const canManage = isAdmin || isOperator;

  const query = useCategories(true);
  const updateStatusMutation = useUpdateCategoryStatus();
  const deleteMutation = useDeleteCategory();

  const [selectedCode, setSelectedCode] = useState<string>('');
  const [searchTree, setSearchTree] = useState('');
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  // Dialog & Modal states
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    category?: Category | null;
    parentCategoryId?: string | null;
  }>({ open: false });

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const categories = useMemo(() => query.data ?? [], [query.data]);

  // Default selection
  const activeCode = useMemo(() => {
    if (selectedCode && categories.some((c) => c.code.toLowerCase() === selectedCode.toLowerCase())) {
      return selectedCode;
    }
    return categories[0]?.code ?? '';
  }, [selectedCode, categories]);

  useEffect(() => {
    if (!selectedCode && categories.length > 0) {
      setSelectedCode(categories[0].code);
    }
  }, [selectedCode, categories]);

  // Default open state for tree branches
  useEffect(() => {
    if (categories.length > 0 && Object.keys(openState).length === 0) {
      const initial: Record<string, boolean> = {};
      for (const c of categories) {
        initial[(c.id || c.code).toLowerCase()] = true;
      }
      setOpenState(initial);
    }
  }, [categories, openState]);

  const selectedCat = useMemo(
    () => findCategory(categories, activeCode) || categories[0] || null,
    [categories, activeCode],
  );

  const detailQuery = useCategory(selectedCat?.code ?? '');

  // Flattened tree rows with indentation and caret
  const flatRows = useMemo(
    () => buildFlatTree(categories, openState, searchTree),
    [categories, openState, searchTree],
  );

  // Expand / Collapse all handlers
  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const c of categories) {
      next[(c.id || c.code).toLowerCase()] = true;
      next[c.code.toLowerCase()] = true;
    }
    setOpenState(next);
  };

  const handleCollapseAll = () => {
    setOpenState({});
  };

  const toggleNode = (c: Category, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = (c.id || c.code).toLowerCase();
    setOpenState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Node details calculations
  const selectedDepth = useMemo(
    () => (selectedCat ? getCategoryDepth(categories, selectedCat) : 0),
    [categories, selectedCat],
  );

  const selectedKids = useMemo(
    () => (selectedCat ? getCategoryChildren(categories, selectedCat) : []),
    [categories, selectedCat],
  );

  const hasKids = selectedKids.length > 0;
  const isLeaf = !hasKids;
  const canAddChild = selectedCat ? canAddSubcategory(categories, selectedCat) : false;

  const selectedPath = useMemo(
    () => (selectedCat ? getCategoryPath(categories, selectedCat) : ''),
    [categories, selectedCat],
  );

  const productsList = useMemo(
    () => detailQuery.data?.products ?? [],
    [detailQuery.data?.products],
  );

  const directProductCount = useMemo(() => {
    if (detailQuery.data?.products) return detailQuery.data.products.length;
    return selectedCat?.productCount ?? 0;
  }, [detailQuery.data?.products, selectedCat?.productCount]);

  // Action handlers matching prototype
  const handleOpenAddCategory = () => {
    let defaultParent: string | null = null;
    if (selectedCat) {
      defaultParent =
        selectedDepth <= 1
          ? (selectedCat.id || selectedCat.code)
          : (selectedCat.parentCategoryId ?? null);
    }
    if (!isAdmin && !defaultParent && categories.length > 0) {
      defaultParent = categories[0].id || categories[0].code;
    }
    setDialogState({
      open: true,
      category: null,
      parentCategoryId: isAdmin ? (selectedDepth <= 1 ? defaultParent : null) : defaultParent,
    });
  };

  const handleOpenAddSubCategory = () => {
    if (!selectedCat) return;
    setDialogState({
      open: true,
      category: null,
      parentCategoryId: selectedCat.id || selectedCat.code,
    });
  };

  const handleOpenEdit = () => {
    if (!selectedCat) return;
    setDialogState({
      open: true,
      category: selectedCat,
      parentCategoryId: selectedCat.parentCategoryId,
    });
  };

  const handleToggleStatus = async () => {
    if (!selectedCat) return;
    const isCurrentlyActive = selectedCat.status === 'Active' || selectedCat.isActive !== false;

    // Check if category has active products before deactivating
    if (isCurrentlyActive) {
      const hasSellingProducts = productsList.some(
        (p) => p.status === 'Đang bán' || p.status === 'Published',
      );
      if (hasSellingProducts) {
        toast.show(`Không ngừng hoạt động được: còn sản phẩm đang bán trong ${selectedCat.name}.`);
        return;
      }
    }

    await updateStatusMutation.mutateAsync({
      idOrCode: selectedCat.id || selectedCat.code,
      isActive: !isCurrentlyActive,
    });
  };

  const handleDeleteClick = () => {
    if (!selectedCat) return;

    if (hasKids) {
      setAlertMessage(`Không xóa được ${selectedCat.name}: còn ${selectedKids.length} danh mục con.`);
      return;
    }

    if (directProductCount > 0) {
      setAlertMessage(
        `Không xóa được ${selectedCat.name}: còn ${directProductCount} sản phẩm đang dùng danh mục này – chuyển Ngừng hoạt động thay vì xóa.`,
      );
      return;
    }

    setDeleteTarget(selectedCat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id || deleteTarget.code);
      setDeleteTarget(null);
      if (deleteTarget.parentCategoryId) {
        const p = findCategory(categories, deleteTarget.parentCategoryId);
        if (p) {
          setSelectedCode(p.code);
          return;
        }
      }
      const remaining = categories.filter((c) => c.code !== deleteTarget.code);
      if (remaining.length > 0) {
        setSelectedCode(remaining[0].code);
      }
    } catch {
      setDeleteTarget(null);
    }
  };

  // Status Chip Style matching Prototype
  const getStatusChipStyle = (status?: string, isActive?: boolean) => {
    const active = isActive !== false && status !== 'Inactive' && status !== 'Ngừng hoạt động';
    if (active) {
      return {
        background: '#E3F0EC',
        color: '#0F5E55',
        height: 22,
        fontSize: 12,
        padding: '0 8px',
        borderRadius: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        fontWeight: 600,
      };
    }
    return {
      background: '#F3F4F1',
      color: '#5B625E',
      height: 22,
      fontSize: 12,
      padding: '0 8px',
      borderRadius: 9999,
      display: 'inline-flex',
      alignItems: 'center',
      fontWeight: 500,
    };
  };

  const getProductStatusStyle = (status: string) => {
    if (status === 'Đang bán' || status === 'Published' || status === 'Active') {
      return { background: '#E3F0EC', color: '#0F5E55' };
    }
    if (status === 'Hết hàng' || status === 'OutOfStock') {
      return { background: '#FDECEA', color: '#B42318' };
    }
    return { background: '#F3F4F1', color: '#5B625E' };
  };

  return (
    <>
      {/* Category Tree Layout matching Prototype HTML */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: '380px minmax(0, 1fr)',
          gap: 16,
        }}
      >
        {/* Left column: Category Tree Card */}
        <section
          className="card"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderBottom: '1px solid #E2E5E0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontWeight: 700 }}>
                Cây danh mục{' '}
                <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
                  · {categories.length} danh mục
                </span>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleOpenAddCategory}
                >
                  + Tạo danh mục
                </button>
              )}
            </div>

            <input
              className="inp"
              placeholder="Tìm danh mục…"
              aria-label="Tìm danh mục"
              value={searchTree}
              onChange={(e) => setSearchTree(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-sm" onClick={handleExpandAll}>
                Mở hết
              </button>
              <button type="button" className="btn btn-sm" onClick={handleCollapseAll}>
                Thu gọn
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8 }} role="tree">
            {flatRows.map((r) => {
              const c = r.category;
              const isSelected = c.code === activeCode;
              const isInactive = c.status === 'Inactive' || c.isActive === false;
              const count = c.productCount ?? 0;

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
                    minHeight: 38,
                    padding: `6px 10px 6px ${10 + r.depth * 22}px`,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                    background: isSelected ? '#E3F0EC' : 'transparent',
                    color: isSelected ? '#0F5E55' : '#1B1F1D',
                    fontWeight: isSelected ? 700 : 400,
                    opacity: isInactive ? 0.55 : 1,
                    marginBottom: 2,
                  }}
                  onClick={() => {
                    setSelectedCode(c.code);
                    if (r.hasKids) {
                      toggleNode(c);
                    }
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      flex: '0 0 18px',
                      color: '#5B625E',
                      fontSize: 12,
                      textAlign: 'center',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      if (r.hasKids) {
                        toggleNode(c, e);
                      }
                    }}
                  >
                    {r.hasKids ? (r.isOpen ? '▾' : '▸') : '•'}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="chip"
                    style={{
                      background: '#EEF1EC',
                      color: '#4A524E',
                      height: 20,
                      fontSize: 11,
                      padding: '0 6px',
                      borderRadius: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {count} SP
                  </span>
                </button>
              );
            })}

            {flatRows.length === 0 && (
              <p className="muted" style={{ textAlign: 'center', padding: 20, margin: 0, fontSize: 13 }}>
                Không tìm thấy danh mục phù hợp.
              </p>
            )}
          </div>
        </section>

        {/* Right column: Category Details, Subcategories, and Products */}
        <div
          className="vscroll"
          style={{ minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {selectedCat ? (
            <>
              {/* Details card matching Prototype */}
              <section
                className="card"
                style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {selectedPath || 'Danh mục gốc'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>
                      {selectedCat.name}{' '}
                      <span
                        className="chip"
                        style={getStatusChipStyle(selectedCat.status, selectedCat.isActive)}
                      >
                        {selectedCat.status === 'Active' || selectedCat.isActive !== false
                          ? 'Hoạt động'
                          : 'Ngừng hoạt động'}
                      </span>
                    </span>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {canAddChild && (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={handleOpenAddSubCategory}
                        >
                          + Danh mục con
                        </button>
                      )}
                      <button type="button" className="btn" onClick={handleOpenEdit}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDeleteClick}
                      >
                        Xóa
                      </button>
                      {selectedCat.status === 'Active' || selectedCat.isActive !== false ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={updateStatusMutation.isPending}
                          onClick={handleToggleStatus}
                        >
                          Ngừng hoạt động
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={updateStatusMutation.isPending}
                          onClick={handleToggleStatus}
                        >
                          Kích hoạt lại
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '14px 32px',
                  }}
                >
                  <div className="fv">
                    <span className="fl">Mã danh mục</span>
                    <span className="fval">{selectedCat.code}</span>
                  </div>
                  <div className="fv">
                    <span className="fl">Cấp</span>
                    <span className="fval">
                      Cấp {selectedDepth + 1}
                      {isLeaf
                        ? ' · danh mục lá (gán được sản phẩm)'
                        : ` · có ${selectedKids.length} danh mục con`}
                    </span>
                  </div>
                  <div className="fv">
                    <span className="fl">Mô tả</span>
                    <span className="fval">{selectedCat.description || '—'}</span>
                  </div>
                </div>
              </section>

              {/* Sub-categories section matching Prototype */}
              {hasKids && (
                <section
                  className="card"
                  style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <h2 className="sec" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    Danh mục con
                  </h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedKids.map((k) => (
                      <button
                        key={k.code}
                        type="button"
                        className="btn btn-sm"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedCode(k.code);
                          // Auto expand parent node
                          setOpenState((prev) => ({
                            ...prev,
                            [(selectedCat.id || selectedCat.code).toLowerCase()]: true,
                          }));
                        }}
                      >
                        {k.name} · {k.productCount ?? 0} SP
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Products in this category branch matching Prototype */}
              <section
                className="card"
                style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="sec" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    Sản phẩm trong nhánh này (gồm danh mục con)
                  </h2>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {productsList.length} sản phẩm
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px minmax(0, 2fr) minmax(0, 2fr) 120px 120px',
                    padding: '8px 0',
                    fontWeight: 600,
                    fontSize: 13,
                    color: '#5B625E',
                    borderBottom: '1px solid #E2E5E0',
                  }}
                >
                  <div className="th">SKU</div>
                  <div className="th">Tên sản phẩm</div>
                  <div className="th">Danh mục</div>
                  <div className="th" style={{ textAlign: 'right' }}>
                    Giá bán
                  </div>
                  <div className="th" style={{ textAlign: 'center' }}>
                    Trạng thái
                  </div>
                </div>

                {detailQuery.isLoading ? (
                  <div className="loading" style={{ padding: 20, textAlign: 'center' }}>
                    <span className="spinner" /> Đang tải sản phẩm…
                  </div>
                ) : productsList.length > 0 ? (
                  <div>
                    {productsList.map((p) => {
                      const statusStyle = getProductStatusStyle(p.status);
                      return (
                        <button
                          key={p.sku}
                          type="button"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '90px minmax(0, 2fr) minmax(0, 2fr) 120px 120px',
                            border: 'none',
                            background: 'transparent',
                            padding: '10px 0',
                            borderTop: '1px solid #E2E5E0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: 13.5,
                            fontFamily: 'inherit',
                            width: '100%',
                            alignItems: 'center',
                          }}
                          onClick={() => navigate(`/skus/${p.sku}`)}
                        >
                          <span style={{ fontWeight: 700, color: '#14655B' }}>{p.sku}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </span>
                          <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedCat.name}
                          </span>
                          <span style={{ textAlign: 'right', fontWeight: 500 }}>
                            {formatMoney(p.basePrice)}
                          </span>
                          <span style={{ textAlign: 'center' }}>
                            <span
                              className="chip"
                              style={{
                                ...statusStyle,
                                height: 20,
                                fontSize: 11,
                                padding: '0 8px',
                                borderRadius: 9999,
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                            >
                              {p.status}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted" style={{ textAlign: 'center', padding: '24px 0', margin: 0, fontSize: 13.5 }}>
                    Chưa có sản phẩm nào trong nhánh này.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="card">
              <div className="empty" style={{ padding: 40, textAlign: 'center' }}>
                <div className="empty-title" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Chọn một danh mục bên trái
                </div>
                <div className="empty-desc" style={{ color: '#5B625E', fontSize: 13.5 }}>
                  Chọn danh mục từ cây để xem chi tiết, danh mục con và danh sách sản phẩm.
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Category Create/Edit Modal matching Prototype */}
      <CategoryDialog
        open={dialogState.open}
        category={dialogState.category}
        parentCategoryId={dialogState.parentCategoryId}
        categories={categories}
        isAdmin={isAdmin}
        onClose={() => setDialogState({ open: false })}
        onSuccess={(cat) => {
          setSelectedCode(cat.code);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Xóa danh mục ${deleteTarget?.code}`}
        message={
          <div>
            Bạn có chắc muốn xóa danh mục <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})?
            <br />
            Hành động này không thể hoàn tác.
          </div>
        }
        confirmLabel="Xóa"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Alert Modal for Deletion Blockers */}
      <Modal
        open={!!alertMessage}
        title="Không thể xóa danh mục"
        width={460}
        onClose={() => setAlertMessage(null)}
        footer={
          <Button variant="primary" onClick={() => setAlertMessage(null)}>
            Đã hiểu
          </Button>
        }
      >
        <div style={{ lineHeight: 1.6, fontSize: 13.5 }}>{alertMessage}</div>
      </Modal>
    </>
  );
}
