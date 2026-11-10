import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useState } from 'react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { toApiError } from '@/shared/api/errors';
import {
  AddressLocationPicker,
  Button,
  Card,
  Chip,
  EmptyState,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
  Tabs,
} from '@/shared/ui';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib';
import {
  useRetailer,
  useRetailerLoyalty,
  useRetailerReceivables,
} from '../hooks';
import { RetailerFormDialog } from '../components/RetailerFormDialog';
import { CreditTermsCard } from '../components/CreditTermsCard';
import { RetailerMlorTab } from '../components/RetailerMlorTab';
import { RetailerAuditTimeline } from '../components/RetailerAuditTimeline';
import type { Retailer } from '../types';

function DebtTab({ retailer }: { retailer: Retailer }) {
  const rec = useRetailerReceivables(retailer.id, retailer.code);
  const loy = useRetailerLoyalty(retailer.id || retailer.code);
  return (
    <div className="stack" style={{ gap: '20px' }}>
      <CreditTermsCard retailer={retailer} receivables={rec.data ?? []} />
      <Card title="Điểm loyalty">
        {loy.data
          ? `Số dư ${formatNumber(loy.data.availablePoints ?? loy.data.available ?? loy.data.balance ?? 0)} điểm · đang giữ ${formatNumber(loy.data.heldPoints ?? loy.data.held ?? 0)} · khả dụng ${formatNumber(loy.data.availablePoints ?? loy.data.available ?? 0)}`
          : 'Chưa có thông tin'}
      </Card>
      <Card title="Đơn hàng công nợ" flush>
        <QueryState query={rec}>
          {(rows) => (
            <SimpleTable
              rows={rows}
              empty="Retailer chưa có đơn công nợ."
              columns={[
                { header: 'Mã đơn', cell: (r) => r.orderCode },
                {
                  header: 'Kỳ hạn áp dụng',
                  align: 'center',
                  cell: (r) =>
                    r.creditTermDays != null
                      ? `${r.creditTermDays} ngày`
                      : `${retailer.creditTermDays} ngày`,
                },
                {
                  header: 'Mốc tính hạn (Ngày nhận)',
                  cell: (r) =>
                    r.deliveredDate
                      ? formatDate(r.deliveredDate)
                      : 'Chưa nhận đủ',
                },
                {
                  header: 'Hạn thanh toán',
                  cell: (r) =>
                    r.dueDate
                      ? formatDate(r.dueDate)
                      : retailer.creditTermDays
                      ? `Sau nhận đủ ${retailer.creditTermDays} ngày`
                      : '—',
                },
                {
                  header: 'Giá trị điều chỉnh',
                  align: 'right',
                  cell: (r) => formatMoney(r.adjustedAmount ?? r.total ?? 0),
                },
                {
                  header: 'Còn phải thu',
                  align: 'right',
                  cell: (r) => formatMoney(r.outstandingAmount ?? r.outstanding ?? 0),
                },
                {
                  header: 'Trạng thái',
                  cell: (r) => (
                    <StatusChip domain="receivable" value={r.status} />
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function RetailerView({ r }: { r: Retailer }) {
  const [tab, setTab] = useState<'info' | 'mlor' | 'debt' | 'hist'>('info');
  const [edit, setEdit] = useState(false);
  const { user } = useAuth();
  const mayEdit = can(user, 'retailers.edit');
  const mayReadMlor = can(user, 'mlor.read');

  const lat = r.latitude ?? r.lat;
  const lng = r.longitude ?? r.lng;
  const hasCoordinates =
    lat != null &&
    lng != null &&
    !isNaN(Number(lat)) &&
    !isNaN(Number(lng)) &&
    Number(lat) !== 0 &&
    Number(lng) !== 0;
  const mapsUrl = hasCoordinates ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;

  return (
    <>
      <PageHeader
        back="/retailers"
        title={r.code ? `${r.code} · ${r.name}` : r.name || 'Điểm bán'}
        subtitle={r.address || 'Chưa có thông tin địa chỉ'}
        chips={<StatusChip domain="active" value={r.status} />}
        actions={
          mayEdit ? (
            <Button variant="primary" onClick={() => setEdit(true)}>
              Sửa thông tin
            </Button>
          ) : undefined
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            key: 'info',
            label: 'Thông tin chung',
          },
          ...(mayReadMlor
            ? [{ key: 'mlor' as const, label: 'Yêu cầu hạn sử dụng' }]
            : []),
          {
            key: 'debt',
            label: 'Công nợ & tín dụng',
          },
          {
            key: 'hist',
            label: 'Lịch sử thay đổi',
          },
        ]}
      />

      {tab === 'info' && (
        <div className="stack" style={{ gap: '20px' }}>
          {/* A. Thông tin liên hệ */}
          <Card title="A. Thông tin liên hệ">
            <Fields
              cols={3}
              items={[
                { label: 'Tên điểm bán', value: r.name || 'Chưa có thông tin' },
                { label: 'Mã điểm bán', value: r.code || 'Chưa cấp mã' },
                { label: 'Người liên hệ', value: r.contactName || r.contact || 'Chưa có thông tin' },
                { label: 'Số điện thoại', value: r.phone || 'Chưa có thông tin' },
                { label: 'Email', value: r.email || 'Chưa có thông tin' },
                { label: 'Địa chỉ chi tiết', value: r.address || 'Chưa có thông tin' },
              ]}
            />
          </Card>

          {/* B. Vị trí */}
          <Card title="B. Vị trí & Tọa độ">
            <Fields
              cols={3}
              items={[
                { label: 'Khu vực / Vùng hoạt động', value: r.areaName || r.areaCode || 'Chưa có thông tin' },
                { label: 'Nhóm Sales phụ trách', value: r.salesGroupCode || r.groupCode || 'Chưa có thông tin' },
                { label: 'Địa chỉ đăng ký', value: r.address || 'Chưa có thông tin' },
                {
                  label: 'Tọa độ GPS',
                  value: hasCoordinates ? `${lat}, ${lng}` : 'Chưa có thông tin',
                },
                {
                  label: 'Phiên bản vị trí',
                  value: r.locationVersion != null ? `v${r.locationVersion}` : 'Chưa có thông tin',
                },
                {
                  label: 'Bản đồ vị trí',
                  value: mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary, #14655B)', textDecoration: 'underline', fontWeight: 600 }}
                    >
                      Mở trên Google Maps ↗
                    </a>
                  ) : (
                    'Chưa có thông tin'
                  ),
                },
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <AddressLocationPicker
                mode="view"
                address={r.address}
                lat={hasCoordinates ? Number(lat) : null}
                lng={hasCoordinates ? Number(lng) : null}
                entityKind="ret"
                entityName={r.name}
                height={320}
              />
            </div>
          </Card>

          {/* C. Quy mô kinh doanh */}
          <Card title="C. Quy mô kinh doanh">
            <Fields
              cols={3}
              items={[
                { label: 'Loại hình điểm bán', value: r.retailerType || r.kind || 'Chưa có thông tin' },
                {
                  label: 'Diện tích cửa hàng',
                  value: r.storeSizeSquareMeters != null ? `${r.storeSizeSquareMeters} m²` : (r.areaM2 != null ? `${r.areaM2} m²` : 'Chưa có thông tin'),
                },
                {
                  label: 'Phân loại diện tích',
                  value: r.storeSizeCategory || r.size || 'Chưa có thông tin',
                },
                {
                  label: 'Sức mua / tháng',
                  value: r.purchasingCapacity != null ? `${r.purchasingCapacity} thùng / tháng` : (r.monthlyCapacity != null ? `${r.monthlyCapacity} thùng / tháng` : 'Chưa có thông tin'),
                },
                {
                  label: 'Tần suất mua hàng',
                  value: r.purchaseFrequencyPerMonth
                    ? `${r.purchaseFrequencyPerMonth} lần/tháng`
                    : r.orderFrequency || 'Chưa có thông tin',
                },
                {
                  label: 'Số tủ mát bảo quản',
                  value: r.fridges != null ? `${r.fridges} tủ` : 'Chưa có thông tin',
                },
              ]}
            />
          </Card>

          {/* D. Tiềm năng kinh doanh */}
          <Card title="D. Tiềm năng kinh doanh & Khai báo">
            <Fields
              cols={3}
              items={[
                {
                  label: 'Doanh thu dự báo / tháng',
                  value: r.forecastRevenue != null ? formatMoney(r.forecastRevenue) : 'Chưa có thông tin',
                },
                {
                  label: 'Phân hạng tiềm năng',
                  value: r.potentialClass ? <StatusChip value={r.potentialClass} /> : 'Chưa có thông tin',
                },
                {
                  label: 'Khả năng nộp duyệt',
                  value:
                    r.canSubmitForReview != null ? (
                      r.canSubmitForReview ? (
                        <Chip tone="ok">Đủ điều kiện nộp duyệt</Chip>
                      ) : (
                        <Chip tone="warn">Chưa đủ điều kiện</Chip>
                      )
                    ) : (
                      'Chưa có thông tin'
                    ),
                },
                {
                  label: 'Đánh giá / Ghi chú của Sales',
                  value: r.assessmentNote || 'Chưa có thông tin',
                },
                {
                  label: 'Ảnh mặt tiền điểm bán',
                  value: r.storefrontImageUrl ? (
                    <div>
                      <img
                        src={r.storefrontImageUrl}
                        alt="Mặt tiền điểm bán"
                        style={{ maxWidth: '180px', maxHeight: '120px', borderRadius: '6px', border: '1px solid #ddd' }}
                      />
                    </div>
                  ) : (
                    'Chưa có thông tin'
                  ),
                },
                {
                  label: 'Nguồn khai báo',
                  value: r.source || (r.declaredByUserId ? 'Nhân viên kinh doanh' : 'Chưa có thông tin'),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'mlor' && mayReadMlor && (
        <RetailerMlorTab retailer={r} />
      )}

      {tab === 'debt' && <DebtTab retailer={r} />}

      {tab === 'hist' && <RetailerAuditTimeline retailer={r} />}

      <RetailerFormDialog open={edit} retailer={r} onClose={() => setEdit(false)} />
    </>
  );
}

/** Route /retailers/:id or /retailers/:code – loads real Retailer detail from Backend API. */
export function RetailerDetailPage() {
  const { id, code } = useParams();
  const navigate = useNavigate();
  const identifier = id || code || '';
  const retailer = useRetailer(identifier);

  if (!identifier) {
    return (
      <EmptyState
        title="Không tìm thấy Retailer"
        description="Mã điểm bán không hợp lệ hoặc thiếu định danh."
        action={
          <Button variant="default" onClick={() => navigate('/retailers')}>
            Quay lại danh sách
          </Button>
        }
      />
    );
  }

  if (retailer.isLoading) {
    return (
      <div className="loading">
        <span className="spinner" /> Đang tải thông tin điểm bán…
      </div>
    );
  }

  if (retailer.error) {
    const apiError = toApiError(retailer.error);
    if (apiError.status === 404) {
      return (
        <EmptyState
          title="Không tìm thấy Retailer"
          description="Không tìm thấy Retailer này. Thông tin có thể đã được thay đổi hoặc không còn tồn tại."
          action={
            <Button variant="default" onClick={() => navigate('/retailers')}>
              Quay lại danh sách
            </Button>
          }
        />
      );
    }
    if (apiError.status === 403) {
      return (
        <EmptyState
          title="Không có quyền truy cập"
          description="Bạn không có quyền xem thông tin Retailer này."
          action={
            <Button variant="default" onClick={() => navigate('/retailers')}>
              Quay lại danh sách
            </Button>
          }
        />
      );
    }
    if (apiError.status === 401) {
      return (
        <EmptyState
          title="Phiên đăng nhập hết hạn"
          description="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          action={
            <Button variant="primary" onClick={() => (window.location.href = '/login')}>
              Đăng nhập lại
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description="Không thể tải thông tin Retailer. Vui lòng thử lại."
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={() => retailer.refetch()}>
              Thử lại
            </Button>
            <Button variant="default" onClick={() => navigate('/retailers')}>
              Quay lại danh sách
            </Button>
          </div>
        }
      />
    );
  }

  if (!retailer.data) {
    return (
      <EmptyState
        title="Không tìm thấy Retailer"
        description="Không tìm thấy Retailer này. Thông tin có thể đã được thay đổi hoặc không còn tồn tại."
        action={
          <Button variant="default" onClick={() => navigate('/retailers')}>
            Quay lại danh sách
          </Button>
        }
      />
    );
  }

  return <RetailerView r={retailer.data} />;
}
