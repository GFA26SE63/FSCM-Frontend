import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import {
  Button,
  Callout,
  Card,
  Chip,
  ConfirmDialog,
  Select,
  SimpleTable,
} from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { productApi } from '@/features/products/api';
import {
  useDeleteMlor,
  useRetailerMlorConfigs,
  useResolveMlor,
} from '../hooks';
import type { MlorConfigItem, Retailer } from '../types';
import { MlorRuleDialog } from './MlorRuleDialog';

interface RetailerMlorTabProps {
  retailer: Retailer;
}

export function RetailerMlorTab({ retailer }: RetailerMlorTabProps) {
  const { user } = useAuth();
  const mayRead = can(user, 'mlor.read');
  const mayManage = can(user, 'mlor.manage');

  const retailerId = retailer.id || retailer.code;

  const configsQuery = useRetailerMlorConfigs(retailerId, mayRead);
  const productsQuery = useQuery({
    queryKey: ['products', 'all-for-mlor'],
    queryFn: productApi.list,
    enabled: mayRead,
  });
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'all-for-mlor'],
    queryFn: productApi.categories,
    enabled: mayRead,
  });

  const deleteMlor = useDeleteMlor(retailerId);

  const [editingConfig, setEditingConfig] = useState<MlorConfigItem | null>(null);

  // Dialog states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<MlorConfigItem | null>(null);

  // Tra cứu quy tắc áp dụng
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const resolutionQuery = useResolveMlor(retailerId, selectedProductId, Boolean(selectedProductId));

  const allConfigs = useMemo(() => configsQuery.data ?? [], [configsQuery.data]);
  const categoryConfigs = useMemo(
    () => allConfigs.filter((c) => Boolean(c.productCategoryId) && !c.productId),
    [allConfigs],
  );
  const productConfigs = useMemo(
    () => allConfigs.filter((c) => Boolean(c.productId)),
    [allConfigs],
  );

  const categories = categoriesQuery.data ?? [];
  const products = productsQuery.data ?? [];

  if (!mayRead) {
    return (
      <Callout tone="warn">
        Bạn không có quyền xem cấu hình yêu cầu hạn sử dụng (MLOR).
      </Callout>
    );
  }

  if (configsQuery.isLoading) return <Callout tone="info">Đang tải yêu cầu hạn sử dụng…</Callout>;
  if (configsQuery.error) return <Callout tone="danger">Không tải được yêu cầu hạn sử dụng.
    <Button size="sm" onClick={() => { void configsQuery.refetch(); }}>Thử lại</Button>
  </Callout>;

  const lookupsReady = productsQuery.isSuccess && categoriesQuery.isSuccess;

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.sku} · ${p.name}`,
  }));

  return (
    <div className="stack" style={{ gap: '20px' }}>
      {(configsQuery.isLoading || productsQuery.isLoading || categoriesQuery.isLoading) &&
        <Callout tone="info">Đang tải yêu cầu hạn sử dụng và danh mục sản phẩm…</Callout>}
      {(configsQuery.error || productsQuery.error || categoriesQuery.error) &&
        <Callout tone="danger">Không tải đầy đủ yêu cầu hạn sử dụng hoặc danh mục sản phẩm. Vui lòng tải lại trước khi chỉnh sửa.</Callout>}
      {/* MLOR Precedence Rule Callout */}
      <Callout tone="info">
        <div style={{ display: 'grid', gap: '6px' }}>
          <strong>Quy tắc thứ tự ưu tiên hạn sử dụng (MLOR):</strong>
          <div>
            1. <strong>Yêu cầu riêng theo sản phẩm</strong> (Ưu tiên cao nhất) → 
            2. <strong>Áp dụng theo danh mục</strong> (Mức trung gian) → 
            3. <strong>Mặc định của sản phẩm</strong> (Mức cơ sở).
          </div>
          <div className="muted" style={{ fontSize: '13px' }}>
            Hệ thống tự động giải quyết theo thứ bậc trên khi tạo đơn, xếp chuyến và xuất kho giao hàng.
          </div>
        </div>
      </Callout>

      {/* 1. Yêu cầu theo danh mục */}
      <Card
        title="1. Áp dụng theo danh mục"
        actions={
          mayManage ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!lookupsReady}
              onClick={() => setCategoryModalOpen(true)}
            >
              + Thêm yêu cầu theo danh mục
            </Button>
          ) : undefined
        }
        flush
      >
        <SimpleTable
          rows={categoryConfigs}
          empty="Chưa có yêu cầu hạn sử dụng theo danh mục nào cho điểm bán này."
          columns={[
            {
              header: 'Mã danh mục',
              width: '140px',
              cell: (r) => r.categoryCode || '—',
            },
            {
              header: 'Tên danh mục',
              cell: (r) => r.categoryName || '—',
            },
            {
              header: 'Tỷ lệ HSD tối thiểu',
              align: 'right',
              width: '160px',
              cell: (r) => `${(r.minimumLifeRatio * 100).toFixed(0)}% (${formatNumber(r.minimumLifeRatio, 2)})`,
            },
            {
              header: 'HSD tối thiểu (giờ)',
              align: 'right',
              width: '160px',
              cell: (r) => (r.minimumLifeHours != null ? `${r.minimumLifeHours} giờ` : '—'),
            },
            {
              header: 'Thao tác',
              align: 'right',
              width: '180px',
              cell: (r) =>
                mayManage ? (
                  <div className="row-wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <Button size="sm" disabled={!lookupsReady} onClick={() => setEditingConfig(r)}>Sửa</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeletingConfig(r)}
                  >
                    Xóa
                  </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      {/* 2. Yêu cầu riêng theo sản phẩm */}
      <Card
        title="2. Yêu cầu riêng theo sản phẩm"
        actions={
          mayManage ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!lookupsReady}
              onClick={() => setProductModalOpen(true)}
            >
              + Thêm yêu cầu theo sản phẩm
            </Button>
          ) : undefined
        }
        flush
      >
        <SimpleTable
          rows={productConfigs}
          empty="Chưa có yêu cầu riêng theo sản phẩm (SKU) nào cho điểm bán này."
          columns={[
            {
              header: 'SKU',
              width: '130px',
              cell: (r) => r.productSku || '—',
            },
            {
              header: 'Tên sản phẩm',
              cell: (r) => r.productName || '—',
            },
            {
              header: 'Tỷ lệ HSD tối thiểu',
              align: 'right',
              width: '160px',
              cell: (r) => `${(r.minimumLifeRatio * 100).toFixed(0)}% (${formatNumber(r.minimumLifeRatio, 2)})`,
            },
            {
              header: 'HSD tối thiểu (giờ)',
              align: 'right',
              width: '160px',
              cell: (r) => (r.minimumLifeHours != null ? `${r.minimumLifeHours} giờ` : '—'),
            },
            {
              header: 'Thao tác',
              align: 'right',
              width: '180px',
              cell: (r) =>
                mayManage ? (
                  <div className="row-wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
                  <Button size="sm" disabled={!lookupsReady} onClick={() => setEditingConfig(r)}>Sửa</Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeletingConfig(r)}
                  >
                    Xóa
                  </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </Card>

      {/* 3. Tra cứu quy tắc áp dụng */}
      <Card title="3. Tra cứu yêu cầu đang áp dụng">
        <div style={{ display: 'grid', gap: '16px' }}>
          <p className="muted" style={{ margin: 0 }}>
            Chọn một sản phẩm để kiểm tra quy tắc hạn sử dụng thực tế sẽ được áp dụng cho điểm bán theo thứ bậc ưu tiên.
          </p>

          <div style={{ maxWidth: '450px' }}>
            <label className="lbl">
              Chọn sản phẩm cần tra cứu
              <Select
                value={selectedProductId}
                options={[
                  { value: '', label: '-- Chọn sản phẩm để kiểm tra kết quả áp dụng --' },
                  ...productOptions,
                ]}
                onChange={(e) => setSelectedProductId(e.target.value)}
              />
            </label>
          </div>

          {selectedProductId && (
            <div
              style={{
                background: 'var(--surface-subtle, #f8f9fa)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              {resolutionQuery.isLoading && <div>Đang kiểm tra yêu cầu hạn sử dụng...</div>}
              {resolutionQuery.error && (
                <Callout tone="danger">
                  Chưa thể xác định yêu cầu hạn sử dụng đang áp dụng cho sản phẩm này. Vui lòng thử lại sau.
                </Callout>
              )}
              {resolutionQuery.data && (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>Cấp độ ưu tiên đang áp dụng:</span>
                    {resolutionQuery.data.sourceScope === 'RetailerProduct' && (
                      <Chip tone="ok">Yêu cầu riêng theo sản phẩm (Mức cao nhất)</Chip>
                    )}
                    {resolutionQuery.data.sourceScope === 'RetailerCategory' && (
                      <Chip tone="info">Áp dụng theo danh mục (Mức 2)</Chip>
                    )}
                    {resolutionQuery.data.sourceScope === 'ProductDefault' && (
                      <Chip tone="neutral">Mặc định của sản phẩm (Mức cơ sở)</Chip>
                    )}
                    {!resolutionQuery.data.sourceScope && (
                      <Chip tone="warn">Không xác định nguồn</Chip>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '4px' }}>
                    <div>
                      <div className="muted" style={{ fontSize: '13px' }}>Tỷ lệ HSD tối thiểu</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--primary, #14655B)' }}>
                        {(resolutionQuery.data.minimumLifeRatio * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: '13px' }}>Số giờ tối thiểu</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>
                        {resolutionQuery.data.minimumLifeHours != null
                          ? `${resolutionQuery.data.minimumLifeHours} giờ`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="muted" style={{ fontSize: '13px' }}>Phiên bản quy tắc</div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>
                        {resolutionQuery.data.sourceVersion != null
                          ? `v${resolutionQuery.data.sourceVersion}`
                          : 'Mặc định'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {(categoryModalOpen || productModalOpen || editingConfig) && (
        <MlorRuleDialog
          retailerId={retailerId}
          scope={editingConfig ? (editingConfig.productId ? 'product' : 'category') : categoryModalOpen ? 'category' : 'product'}
          config={editingConfig ?? undefined}
          configs={allConfigs}
          categories={categories}
          products={products}
          onClose={() => { setEditingConfig(null); setCategoryModalOpen(false); setProductModalOpen(false); }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deletingConfig !== null}
        title="Xác nhận xóa cấu hình MLOR"
        confirmLabel="Xóa cấu hình"
        danger
        onClose={() => setDeletingConfig(null)}
        onConfirm={async () => {
          if (!deletingConfig) return;
          await deleteMlor.mutateAsync(deletingConfig.id);
          setDeletingConfig(null);
        }}
        message={
          deletingConfig ? (
            <div>
              Bạn có chắc chắn muốn xóa cấu hình MLOR cho{' '}
              <strong>
                {deletingConfig.productSku
                  ? `sản phẩm ${deletingConfig.productSku} - ${deletingConfig.productName}`
                  : `danh mục ${deletingConfig.categoryName || deletingConfig.categoryCode}`}
              </strong>{' '}
              (Tỷ lệ: {(deletingConfig.minimumLifeRatio * 100).toFixed(0)}%)?
            </div>
          ) : ''
        }
      />
    </div>
  );
}
