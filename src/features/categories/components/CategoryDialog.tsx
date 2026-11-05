import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useAuth } from '@/shared/auth/AuthContext';
import { useCreateCategory, useUpdateCategory, useCategories } from '../hooks';
import type { Category } from '../types';
import {
  findCategory,
  getCategoryDepth,
  getCategoryLevel,
  getCategoryPath,
  getCategoryDescendantKeys,
  getCategorySubtreeDepth,
} from '../treeUtils';

export interface CategoryDialogProps {
  open: boolean;
  category?: Category | null;
  parentCategoryId?: string | null;
  categories?: Category[];
  isAdmin?: boolean;
  onClose: () => void;
  onSuccess?: (category: Category) => void;
}

export function CategoryDialog({
  open,
  category,
  parentCategoryId,
  categories: propCategories,
  isAdmin: propIsAdmin,
  onClose,
  onSuccess,
}: CategoryDialogProps) {
  const { user } = useAuth();
  const fallbackCategoriesQuery = useCategories(true);
  const categories = useMemo(
    () => propCategories ?? fallbackCategoriesQuery.data ?? [],
    [propCategories, fallbackCategoriesQuery.data],
  );
  const isAdmin = propIsAdmin ?? (user?.role === 'Admin');

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const isEdit = !!category;

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state when dialog opens or inputs change
  useEffect(() => {
    if (open) {
      setStep('form');
      if (category) {
        setName(category.name || '');
        setCode(category.code || '');
        setParentId(category.parentCategoryId || '');
        setDescription(category.description || '');
      } else {
        setName('');
        setCode('');
        let defaultParent = parentCategoryId || '';
        // If user is not Admin and no parent was pre-selected, default to first available active category
        if (!isAdmin && !defaultParent && categories.length > 0) {
          const firstActive = categories.find((c) => c.isActive !== false && c.status !== 'Inactive');
          if (firstActive) {
            defaultParent = firstActive.id || firstActive.code;
          }
        }
        setParentId(defaultParent);
        setDescription('');
      }
      setError(null);
    }
  }, [open, category, parentCategoryId, isAdmin, categories]);

  // Descendants & subtree depth for circular dependency prevention
  const descendantKeys = useMemo(
    () => (isEdit && category ? getCategoryDescendantKeys(categories, category) : new Set<string>()),
    [isEdit, category, categories],
  );

  const subtreeDepth = useMemo(
    () => (isEdit && category ? getCategorySubtreeDepth(categories, category) : 0),
    [isEdit, category, categories],
  );

  // Parent chip options matching HTML prototype CM.parents
  interface ParentOption {
    code: string;
    label: string;
  }

  const parentOptions = useMemo<ParentOption[]>(() => {
    const opts: ParentOption[] = [];

    // Administrator can choose root category (Cấp 1)
    if (isAdmin) {
      opts.push({ code: '', label: 'Không có – tạo danh mục gốc' });
    }

    // Available categories sorted hierarchically
    const sortedCats = [...categories].sort((a, b) => {
      const depthA = getCategoryDepth(categories, a);
      const depthB = getCategoryDepth(categories, b);
      if (depthA !== depthB) return depthA - depthB;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });

    for (const c of sortedCats) {
      // Must be active
      if (c.isActive === false || c.status === 'Inactive') continue;

      const cId = (c.id || '').toLowerCase();
      const cCode = c.code.toLowerCase();

      // In edit mode: cannot select self or descendants (avoids circular graph)
      if (isEdit && (descendantKeys.has(cId) || descendantKeys.has(cCode))) {
        continue;
      }

      // Depth limit: (parent depth + 1 + subtree depth) must be <= 2 (max 3 levels)
      const pDepth = getCategoryDepth(categories, c);
      if (pDepth + 1 + subtreeDepth > 2) {
        continue;
      }

      const indent = pDepth > 0 ? '› '.repeat(pDepth) : '';
      opts.push({
        code: c.id || c.code,
        label: `${indent}${c.name}`,
      });
    }

    return opts;
  }, [isAdmin, categories, isEdit, descendantKeys, subtreeDepth]);

  // Selected parent category object
  const selectedParent = useMemo(() => {
    if (!parentId) return null;
    return findCategory(categories, parentId);
  }, [categories, parentId]);

  // Compute position preview: Path, Parent details, and Level
  const positionPreview = useMemo(() => {
    const trimmedName = name.trim() || '…';
    if (!parentId || !selectedParent) {
      return {
        isRoot: true,
        parentPath: '',
        parentName: '',
        parentCode: '',
        path: trimmedName,
        level: 'Cấp 1 (Gốc)',
        levelNum: 1,
      };
    }
    const parentPath = getCategoryPath(categories, selectedParent, new Set(), ' > ');
    const lvl = getCategoryLevel(categories, selectedParent) + 1;
    return {
      isRoot: false,
      parentPath,
      parentName: selectedParent.name,
      parentCode: selectedParent.code,
      path: `${parentPath} > ${trimmedName}`,
      level: `Cấp ${lvl}`,
      levelNum: lvl,
    };
  }, [name, parentId, selectedParent, categories]);

  if (!open) return null;

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isCreatingRoot = !isEdit && !parentId;

  const validateForm = (): boolean => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nhập tên danh mục.');
      return false;
    }

    // Name uniqueness check matching prototype
    const isDuplicateName = categories.some((c) => {
      const match = c.name.trim().toLowerCase() === trimmedName.toLowerCase();
      if (!match) return false;
      if (isEdit && category) {
        return c.id !== category.id && c.code.toLowerCase() !== category.code.toLowerCase();
      }
      return true;
    });

    if (isDuplicateName) {
      setError(`Tên "${trimmedName}" đã có trên cây danh mục.`);
      return false;
    }

    // Role restrictions: Operator cannot create root category
    if (!parentId && !isAdmin) {
      setError('Chỉ Admin được tạo danh mục gốc – vui lòng chọn danh mục cha.');
      return false;
    }

    // Child category requires valid existing parent
    if (parentId) {
      const parent = findCategory(categories, parentId);
      if (!parent) {
        setError('Danh mục cha đã chọn không tồn tại hoặc không hợp lệ.');
        return false;
      }
      if (parent.isActive === false || parent.status === 'Inactive') {
        setError(`Danh mục cha "${parent.name}" đang bị ngừng hoạt động.`);
        return false;
      }
      const pDepth = getCategoryDepth(categories, parent);
      if (pDepth + 1 + subtreeDepth > 2) {
        setError('Cây danh mục tối đa 3 cấp.');
        return false;
      }
    }

    // Code validation when creating or editing
    if (code.trim()) {
      const trimmedCode = code.trim().toUpperCase();
      const isDuplicateCode = categories.some((c) => {
        const match = c.code.toUpperCase() === trimmedCode;
        if (!match) return false;
        if (isEdit && category) {
          return c.id !== category.id && c.code.toLowerCase() !== category.code.toLowerCase();
        }
        return true;
      });
      if (isDuplicateCode) {
        setError(`Mã danh mục "${trimmedCode}" đã tồn tại trên hệ thống.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!isEdit) {
      // Step: Open warning/confirmation popup as shown in Prototype HTML
      setStep('confirm');
      return;
    }

    // Edit mode: execute update directly
    const trimmedName = name.trim();
    let resolvedParentId: string | null = null;
    if (parentId) {
      const p = findCategory(categories, parentId);
      resolvedParentId = p?.id || parentId;
    }

    try {
      const updated = await updateMutation.mutateAsync({
        id: category!.id,
        code: category!.code,
        parentCategoryId: resolvedParentId,
        name: trimmedName,
        description: description.trim() || undefined,
        status: category!.status,
      });
      onSuccess?.(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi lưu danh mục.';
      setError(msg);
    }
  };

  const handleExecuteCreate = async () => {
    if (!validateForm()) {
      setStep('form');
      return;
    }

    const trimmedName = name.trim();
    let finalCode: string | undefined = undefined;
    if (code.trim()) {
      finalCode = code.trim().toUpperCase();
    }

    let resolvedParentId: string | null = null;
    if (parentId) {
      const p = findCategory(categories, parentId);
      resolvedParentId = p?.id || parentId;
    }

    try {
      const created = await createMutation.mutateAsync({
        parentCategoryId: resolvedParentId,
        code: finalCode,
        name: trimmedName,
        description: description.trim() || undefined,
        status: 'Active',
      });
      onSuccess?.(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo danh mục.';
      setError(msg);
    }
  };

  const modalTitle = isEdit ? `Sửa danh mục ${category?.code}` : 'Tạo danh mục';

  return (
    <div
      className="overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 24, 22, 0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: 520,
          maxWidth: 'calc(100% - 32px)',
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        role="dialog"
        aria-label={
          step === 'confirm'
            ? isCreatingRoot
              ? 'Xác nhận tạo danh mục gốc'
              : 'Xác nhận tạo danh mục con'
            : modalTitle
        }
      >
        {step === 'form' ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{modalTitle}</div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isEdit ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                  <span className="muted">Mã danh mục:</span>
                  <strong style={{ color: '#14655B' }}>{category?.code}</strong>
                </div>
              ) : (
                <label className="lbl">
                  Mã danh mục (tùy chọn)
                  <input
                    className="inp"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Để trống để tự động sinh mã (CAT-xx)"
                    maxLength={20}
                  />
                </label>
              )}

              <label className="lbl">
                Tên danh mục *
                <input
                  className="inp"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ví dụ: Váng sữa"
                  autoFocus
                />
              </label>

              <div className="lbl">
                Nằm trong danh mục
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 6,
                    maxHeight: 150,
                    overflowY: 'auto',
                  }}
                >
                  {parentOptions.map((p) => {
                    const isSelected =
                      p.code === parentId ||
                      (!p.code && !parentId) ||
                      (p.code && parentId && p.code.toLowerCase() === parentId.toLowerCase());
                    return (
                      <button
                        key={p.code || '__root__'}
                        type="button"
                        className="chip"
                        style={{
                          height: 34,
                          padding: '0 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderRadius: 9999,
                          background: isSelected ? '#14655B' : '#FFFFFF',
                          color: isSelected ? '#FFFFFF' : '#1B1F1D',
                          border: isSelected ? 'none' : '1px solid #C9D0CB',
                          fontWeight: isSelected ? 600 : 400,
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          setParentId(p.code);
                          if (error) setError(null);
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  {parentOptions.length === 0 && (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Không có danh mục cha khả dụng.
                    </span>
                  )}
                </div>
              </div>

              {/* Hierarchy and Position Preview in Form */}
              <div
                style={{
                  background: '#F4F5F3',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {positionPreview.isRoot ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="muted">Vị trí dự kiến: </span>
                    <strong style={{ color: '#14655B' }}>{positionPreview.path}</strong>
                    <span
                      className="chip"
                      style={{
                        background: '#E6F4EA',
                        color: '#137333',
                        fontSize: 11,
                        height: 20,
                        padding: '0 8px',
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      Danh mục gốc (Cấp 1)
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="muted">Danh mục cha: </span>
                      <strong>
                        {selectedParent ? `${selectedParent.name} (${selectedParent.code})` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="muted">Đường dẫn phân cấp: </span>
                      <strong style={{ color: '#14655B' }}>{positionPreview.path}</strong>
                      <span className="muted"> · {positionPreview.level}</span>
                    </div>
                  </>
                )}
              </div>

              <label className="lbl">
                Mô tả (không bắt buộc)
                <input
                  className="inp"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ví dụ: hộp nhỏ, bảo quản lạnh"
                />
              </label>

              {error && (
                <div
                  style={{
                    background: '#FDECEA',
                    color: '#B42318',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn" onClick={onClose} disabled={isSubmitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isEdit ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </>
        ) : isCreatingRoot ? (
          /* Distinct Root Category Confirmation Popup (Administrator only) */
          <>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1B1F1D' }}>
              Xác nhận tạo danh mục gốc
            </div>

            <div
              style={{
                background: '#FEF3F2',
                border: '1px solid #FECDCA',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: '#B42318',
              }}
            >
              Bạn đang tạo một nhóm danh mục cấp cao mới dùng chung cho toàn bộ hệ thống FSCM. Vui lòng đảm bảo danh mục phù hợp với phạm vi FMCG ngắn hạn và không trùng với các nhóm hiện có.
            </div>

            <div
              style={{
                background: '#F4F5F3',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div>
                <span className="muted">Tên danh mục mới: </span>
                <strong style={{ color: '#14655B' }}>{name.trim()}</strong>
              </div>
              <div>
                <span className="muted">Mã danh mục: </span>
                <strong>{code.trim().toUpperCase() || '(Tự động sinh mã)'}</strong>
              </div>
              <div>
                <span className="muted">Cấp: </span>
                <span style={{ fontWeight: 600 }}>Danh mục gốc (Cấp 1)</span>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: '#FDECEA',
                  color: '#B42318',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                className="btn"
                disabled={isSubmitting}
                onClick={() => {
                  setStep('form');
                  setError(null);
                }}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleExecuteCreate}
              >
                {isSubmitting ? 'Đang tạo…' : 'Xác nhận tạo'}
              </button>
            </div>
          </>
        ) : (
          /* Distinct Child Category Confirmation Popup */
          <>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#1B1F1D' }}>
              Xác nhận tạo danh mục con
            </div>

            <div
              style={{
                background: '#F0F9FF',
                border: '1px solid #B9E6FE',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13.5,
                lineHeight: 1.55,
                color: '#026AA2',
              }}
            >
              Vui lòng kiểm tra danh mục mới có phù hợp với nhóm cha đã chọn trước khi xác nhận.
            </div>

            <div
              style={{
                background: '#F4F5F3',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div>
                <span className="muted">Tên danh mục mới: </span>
                <strong style={{ color: '#14655B' }}>{name.trim()}</strong>
              </div>
              {code.trim() && (
                <div>
                  <span className="muted">Mã danh mục: </span>
                  <strong>{code.trim().toUpperCase()}</strong>
                </div>
              )}
              <div>
                <span className="muted">Danh mục cha đã chọn: </span>
                <strong>
                  {selectedParent ? `${selectedParent.name} (${selectedParent.code})` : '—'}
                </strong>
              </div>
              <div>
                <span className="muted">Đường dẫn phân cấp đầy đủ: </span>
                <strong style={{ color: '#14655B' }}>{positionPreview.path}</strong>
              </div>
              <div>
                <span className="muted">Cấp danh mục: </span>
                <span style={{ fontWeight: 600 }}>{positionPreview.level}</span>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: '#FDECEA',
                  color: '#B42318',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                type="button"
                className="btn"
                disabled={isSubmitting}
                onClick={() => {
                  setStep('form');
                  setError(null);
                }}
              >
                Chọn lại danh mục cha
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={handleExecuteCreate}
              >
                {isSubmitting ? 'Đang tạo…' : 'Xác nhận tạo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
