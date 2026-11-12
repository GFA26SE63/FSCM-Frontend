import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, Chip, Input, Select, type Tone } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { useApiMutation } from '@/shared/hooks/useApiMutation';
import { shipmentsApi } from '../api';
import type { DeliveryDriver, DeliveryVehicle, Shipment, ShipmentPartStatus } from '../types';
import type { ShipmentSort } from '../exportList';

const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'success', label: 'Sẵn sàng' },
  Issued: { tone: 'success', label: 'Đã xuất' },
  Delivering: { tone: 'warn', label: 'Đang giao' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

export function ShipmentOperations({ orderId, sort }: { orderId: string; sort: ShipmentSort }) {
  const { user } = useAuth();
  const mayDispatch = user?.role === 'Admin' || user?.role === 'Operator';
  const shipments = useQuery({
    queryKey: ['shipments', orderId],
    queryFn: () => shipmentsApi.list(orderId),
  });
  const drivers = useQuery({
    queryKey: ['shipments', 'drivers'],
    queryFn: shipmentsApi.drivers,
    enabled: mayDispatch,
  });
  const vehicles = useQuery({
    queryKey: ['shipments', 'vehicles'],
    queryFn: shipmentsApi.vehicles,
    enabled: mayDispatch,
  });

  if (shipments.isPending) return <p className="muted small">Đang tải thao tác vận hành…</p>;
  if (shipments.isError) return <Callout tone="danger">Không tải được shipment của đơn.</Callout>;
  if (!shipments.data?.length) return <p className="muted small">Chưa có shipment được tạo cho đơn này.</p>;

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      {mayDispatch && (drivers.isPending || vehicles.isPending) && <p className="muted small">Đang tải tài xế và xe…</p>}
      {mayDispatch && (drivers.isError || vehicles.isError) && <Callout tone="danger">
        Không tải đầy đủ tài xế hoặc xe. <Button size="sm" onClick={() => { void drivers.refetch(); void vehicles.refetch(); }}>Thử lại</Button>
      </Callout>}
      {[...shipments.data].sort((a, b) => (sort === 'asc' ? 1 : -1) * a.shipmentCode.localeCompare(b.shipmentCode, 'vi', { numeric: true })).map((shipment) => (
        <ShipmentActionRow
          key={shipment.id}
          shipment={shipment}
          mayDispatch={mayDispatch}
          drivers={drivers.data ?? []}
          vehicles={vehicles.data ?? []}
          assignmentLoaded={drivers.isSuccess && vehicles.isSuccess}
        />
      ))}
    </div>
  );
}

export function ShipmentActionRow({
  shipment,
  mayDispatch,
  drivers,
  vehicles,
  assignmentLoaded = true,
}: {
  shipment: Shipment;
  mayDispatch: boolean;
  drivers: DeliveryDriver[];
  vehicles: DeliveryVehicle[];
  assignmentLoaded?: boolean;
}) {
  const warehouseDrivers = drivers.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId);
  const warehouseVehicles = vehicles.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId && item.capacity >= shipment.totalQuantity);
  const [driverId, setDriverId] = useState(warehouseDrivers[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState(warehouseVehicles[0]?.id ?? '');
  const [resolutionReason, setResolutionReason] = useState('');
  const resolve = useApiMutation(shipmentsApi.resolveException, { success: 'Đã xử lý ngoại lệ và cập nhật trạng thái đơn.', onSuccess: () => setResolutionReason('') });
  const selectedDriver = warehouseDrivers.find((item) => item.id === driverId);
  const selectedVehicle = warehouseVehicles.find((item) => item.id === vehicleId);
  const issue = useApiMutation(shipmentsApi.issue, { success: 'Đã xác nhận shipment rời kho; tồn thực tế đã được trừ.' });
  const assign = useApiMutation(shipmentsApi.assign, { success: 'Đã gán tài xế và xe.' });
  const dispatch = useApiMutation(shipmentsApi.dispatch, { success: 'Shipment đã bắt đầu giao; tem đã chuyển InTransit.' });

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
        <strong>{shipment.shipmentCode} · {shipment.warehouseCode}</strong>
        <Chip tone={PART_STATUS[shipment.status]?.tone ?? 'neutral'}>
          {PART_STATUS[shipment.status]?.label ?? shipment.status}
        </Chip>
        {shipment.driverName && <span>{shipment.driverName} · {shipment.plateNumber}</span>}
      </div>

      {shipment.status === 'Ready' && (
        <Button
          size="sm"
          variant="primary"
          loading={issue.isPending}
          onClick={() => issue.mutate(shipment)}
          style={{ marginTop: 8 }}
        >
          Xác nhận xuất kho
        </Button>
      )}

      {shipment.status === 'Exception' && mayDispatch && <div className="stack" style={{ marginTop: 8 }}>
        {shipment.exceptionReason && <Callout tone="danger">{shipment.exceptionReason}</Callout>}
        <Input aria-label="Kết quả xử lý ngoại lệ" placeholder="Nhập lý do / kết quả xử lý" value={resolutionReason} onChange={e => setResolutionReason(e.target.value)} />
        <Button size="sm" loading={resolve.isPending} disabled={!resolutionReason.trim() || resolutionReason.trim().length > 1000}
          onClick={() => resolve.mutate({ shipment, reason: resolutionReason })}>Hoàn tất xử lý ngoại lệ</Button>
      </div>}

      {shipment.status === 'Issued' && mayDispatch && (!shipment.driverId || !shipment.vehicleId) && (
        <div className="row-wrap" style={{ gap: 8, marginTop: 8 }}>
          <Select
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
            placeholder="Chọn tài xế"
            options={warehouseDrivers.map((item) => ({ value: item.id, label: `${item.code} · ${item.fullName}` }))}
          />
          <Select
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            placeholder="Chọn xe"
            options={warehouseVehicles.map((item) => ({ value: item.id, label: `${item.plateNumber} · ${formatNumber(item.capacity)} thùng` }))}
          />
          <Button
            size="sm"
            loading={assign.isPending}
            disabled={!assignmentLoaded || !selectedDriver || !selectedVehicle}
            onClick={() => {
              if (selectedDriver && selectedVehicle) assign.mutate({ shipment, driverId: selectedDriver.id, vehicleId: selectedVehicle.id });
            }}
          >
            Gán xe & tài xế
          </Button>
          {assignmentLoaded && warehouseVehicles.length === 0 && <span className="muted small">Kho chưa có xe đang hoạt động đủ tải cho {formatNumber(shipment.totalQuantity)} thùng.</span>}
        </div>
      )}

      {shipment.status === 'Issued' && mayDispatch && shipment.driverId && shipment.vehicleId && (
        <Button
          size="sm"
          variant="primary"
          loading={dispatch.isPending}
          onClick={() => dispatch.mutate(shipment)}
          style={{ marginTop: 8 }}
        >
          Bắt đầu giao
        </Button>
      )}
    </div>
  );
}
