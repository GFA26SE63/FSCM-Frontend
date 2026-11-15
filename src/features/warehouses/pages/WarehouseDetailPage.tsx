import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useNavigate, useParams } from '@/shared/router/compat';
import { useAuth } from '@/shared/auth/AuthContext';
import { formatMoney } from '@/shared/lib';
import {
  Button,
  Callout,
  Card,
  Chip,
  Fields,
  PageHeader,
  QueryState,
  SimpleTable,
  StatusChip,
  useToast,
} from '@/shared/ui';
import { buildWarehouseMapDoc } from '../components/warehouseMap';
import { DeactivateWarehouseModal } from '../components/DeactivateWarehouseModal';
import {
  useRegions,
  useRetailerMapPoints,
  useUpdateWarehouseStatus,
  useWarehouse,
  useWarehouses,
} from '../hooks';
import type { MapPoint } from '../types';

export function WarehouseDetailPage() {
  const { code = '' } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canViewInventory =
    user?.role === 'Admin' ||
    user?.role === 'Operator' ||
    user?.role === 'WarehouseKeeper';

  const query = useWarehouse(code, canViewInventory);
  const wh = query.data;
  const { data: allWarehouses = [] } = useWarehouses();
  const { data: regions = [] } = useRegions();
  const { data: retailers = [] } = useRetailerMapPoints();
  const updateStatus = useUpdateWarehouseStatus();
  const toast = useToast();
  const navigate = useNavigate();

  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);

  const region = useMemo(() => {
    if (!wh?.regionId) return null;
    return regions.find((r) => r.id === wh.regionId);
  }, [wh, regions]);

  const lowStockWarnings = useMemo(() => {
    if (!wh || !wh.inventory?.length) return [];
    const min = wh.minStock ?? 30;
    const bySku = new Map<string, number>();
    for (const item of wh.inventory) {
      if (item.expiryStatus === 'Expired' || item.expiryStatus === 'Disposed') {
        continue;
      }
      bySku.set(item.sku, (bySku.get(item.sku) ?? 0) + item.available);
    }
    const low: string[] = [];
    bySku.forEach((have, sku) => {
      if (have > 0 && have < min) {
        low.push(`${sku}: còn ${have} thùng (< ${min})`);
      }
    });
    return low;
  }, [wh]);

  const mapSrcDoc = useMemo(() => {
    if (!wh) return '';
    const dmax = wh.dmaxRetailerKm ?? 20;
    const points: MapPoint[] = [
      {
        lat: wh.lat,
        lng: wh.lng,
        kind: 'wh',
        label: `${wh.code} · ${wh.name}`,
        sub: wh.address,
      },
      ...allWarehouses
        .filter((x) => x.code !== wh.code)
        .map((x) => ({
          lat: x.lat,
          lng: x.lng,
          kind: 'wh' as const,
          label: `${x.code} · ${x.name}`,
          sub: x.address,
        })),
      ...retailers.map((r) => ({
        lat: r.lat,
        lng: r.lng,
        kind: 'ret' as const,
        label: r.name,
        sub: `${r.code} · ${r.address}`,
      })),
    ];
    return buildWarehouseMapDoc({
      center: [wh.lat, wh.lng],
      points,
      radiusKm: dmax,
      zoom: 12,
    });
  }, [wh, allWarehouses, retailers]);

  const handleConfirmDeactivate = async (reason: string) => {
    if (!wh) return;
    try {
      await updateStatus.mutateAsync({ code: wh.code, isActive: false });
      toast.show(`Đã vô hiệu hóa kho ${wh.code}. Lý do: ${reason}`);
    } catch (e) {
      toast.error(e);
    } finally {
      setDeactivateModalOpen(false);
    }
  };

  const handleToggleStatus = async (codeTarget: string, curStatus: 'Active' | 'Paused') => {
    if (curStatus === 'Active') {
      setDeactivateModalOpen(true);
      return;
    }
    try {
      await updateStatus.mutateAsync({ code: codeTarget, isActive: true });
      toast.show(`Đã kích hoạt lại kho ${codeTarget}.`);
    } catch (e) {
      toast.error(e);
    }
  };

  const dmax = wh?.dmaxRetailerKm ?? 20;

  return (
    <QueryState query={query}>
      {(whData) => (
        <>
          <PageHeader
            back={whData.regionId ? `/whs/regions/${whData.regionId}` : '/whs'}
            title={`${whData.code} · ${whData.name}`}
            subtitle={region ? `Vùng hoạt động: ${region.name} (${region.code})` : undefined}
            chips={<StatusChip domain="active" value={whData.status} />}
            actions={
              isAdmin ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={() => navigate(`/whs/${whData.code}/edit`)}>Sửa</Button>
                  {whData.status === 'Active' ? (
                    <Button
                      variant="danger"
                      disabled={updateStatus.isPending}
                      onClick={() => handleToggleStatus(whData.code, whData.status)}
                    >
                      Vô hiệu hóa
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={updateStatus.isPending}
                      onClick={() => handleToggleStatus(whData.code, whData.status)}
                    >
                      Kích hoạt lại
                    </Button>
                  )}
                </div>
              ) : undefined
            }
          />

          <Card>
            <Fields
              cols={2}
              items={[
                { label: 'Mã kho', value: whData.code },
                { label: 'Tên kho', value: whData.name },
                {
                  label: 'Vùng hoạt động',
                  value: region ? (
                    <span
                      style={{ cursor: 'pointer', color: '#059669', fontWeight: 600 }}
                      onClick={() => navigate(`/whs/regions/${region.id}`)}
                    >
                      {region.name} ({region.code}) ↗
                    </span>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Địa chỉ', value: whData.address },
                {
                  label: 'Tọa độ',
                  value: whData.lat && whData.lng ? `${whData.lat}, ${whData.lng}` : '[lat, lng]',
                },
                { label: 'Thủ kho', value: whData.keeperName || '— Chưa gán' },
                {
                  label: 'Tồn tối thiểu',
                  value: `${whData.minStock ?? 30} thùng / SKU – cảnh báo khi có thể cấp thấp hơn`,
                },
                {
                  label: 'Số batch đang có',
                  value: `${whData.batchCount} batch (${whData.capacityPallets} pallet)`,
                },
              ]}
            />
            {lowStockWarnings.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Callout tone="warn">
                  <strong>Dưới tồn tối thiểu: </strong>
                  {lowStockWarnings.join(' · ')} – cần nhập bổ sung.
                </Callout>
              </div>
            )}
          </Card>

          <Card title={`Bản đồ vị trí kho · vòng tròn bán kính phục vụ ${dmax} km`} flush>
            <iframe
              title="Bản đồ vị trí kho"
              srcDoc={mapSrcDoc}
              style={{
                width: '100%',
                height: 380,
                border: 'none',
              }}
            />
          </Card>

          <Card
            title={`Khoảng cách đường bộ tới retailer (Dijkstra) · Bảng vận chuyển ${
              whData.transitTableVersion ? `v${whData.transitTableVersion}` : 'active'
            }`}
          >
            <SimpleTable
              columns={[
                {
                  header: 'Retailer',
                  cell: (r) => (
                    <b>
                      {r.retailerCode} · {r.retailerName}
                    </b>
                  ),
                },
                {
                  header: 'Khoảng cách',
                  width: '120px',
                  cell: (r) => `${r.km} km`,
                },
                {
                  header: 'Thời gian giao',
                  width: '130px',
                  cell: (r) => (r.transitDays != null ? `${r.transitDays} ngày` : '—'),
                },
                {
                  header: 'Chi phí giao ước tính',
                  width: '160px',
                  cell: (r) => (r.estimatedCost != null ? formatMoney(r.estimatedCost) : '—'),
                },
                {
                  header: `Trong bán kính ${dmax} km`,
                  width: '150px',
                  cell: (r) => (
                    <Chip tone={r.withinRange ? 'success' : 'neutral'}>
                      {r.withinRange ? 'Phục vụ được' : 'Ngoài bán kính'}
                    </Chip>
                  ),
                },
              ]}
              rows={whData.retailerDistances ?? []}
              empty="Chưa có dữ liệu khoảng cách tới retailer."
            />
          </Card>

          {canViewInventory && (
            <Card title="Tồn kho theo lô hàng (Batch)">
              <SimpleTable
                columns={[
                  { header: 'Mã batch', cell: (b) => <b>{b.code}</b> },
                  { header: 'SKU / Tên sản phẩm', cell: (b) => `${b.sku} · ${b.productName}` },
                  {
                    header: 'Hạn sử dụng',
                    cell: (b) => (
                      <span>
                        {b.expiry}
                        {b.remainingDays != null && (
                          <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
                            (còn {b.remainingDays} ngày)
                          </span>
                        )}
                      </span>
                    ),
                  },
                  { header: 'Tồn thực tế', cell: (b) => `${b.onHand} thùng` },
                  { header: 'Đã giữ (Held)', cell: (b) => `${b.held} thùng` },
                  {
                    header: 'Có thể cấp (Available)',
                    cell: (b) => (
                      <span
                        style={{
                          fontWeight: 600,
                          color: b.available > 0 ? '#059669' : '#DC2626',
                        }}
                      >
                        {b.available} thùng
                      </span>
                    ),
                  },
                  {
                    header: 'Tình trạng',
                    cell: (b) => {
                      const tone =
                        b.expiryStatus === 'Expired'
                          ? 'danger'
                          : b.expiryStatus === 'NearExpiry'
                            ? 'warn'
                            : 'success';
                      const label =
                        b.expiryStatus === 'Expired'
                          ? 'Hết hạn'
                          : b.expiryStatus === 'NearExpiry'
                            ? 'Cận hạn'
                            : 'Bình thường';
                      return <Chip tone={tone}>{label}</Chip>;
                    },
                  },
                  {
                    header: 'Thao tác',
                    width: '90px',
                    cell: (b) => (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => navigate(`/batches/${b.id || b.code}`)}
                        title="Xem chi tiết lô hàng"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          fontSize: 12,
                          fontWeight: 600,
                          height: 28,
                        }}
                      >
                        <Eye size={13} />
                        <span>Xem</span>
                      </Button>
                    ),
                  },
                ]}
                rows={whData.inventory ?? []}
                empty="Chưa có tồn kho lô hàng nào tại kho này."
              />
            </Card>
          )}

          {/* Modal: Xác nhận vô hiệu hóa kho */}
          <DeactivateWarehouseModal
            warehouse={whData}
            open={deactivateModalOpen}
            onClose={() => setDeactivateModalOpen(false)}
            onConfirm={handleConfirmDeactivate}
            loading={updateStatus.isPending}
          />
        </>
      )}
    </QueryState>
  );
}
