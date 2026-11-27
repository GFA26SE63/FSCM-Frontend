import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, Chip, Input, Select, type Tone } from '@/shared/ui';
import { formatNumber } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { hasOperation } from '@/shared/auth/permissions';
import { useApiMutation } from '@/shared/hooks/useApiMutation';
import { errorMessage } from '@/shared/api/errors';
import { shipmentsApi } from '../api';
import type { DeliveryDriver, DeliveryVehicle, Shipment, ShipmentPartStatus } from '../types';
import type { ShipmentSort } from '../exportList';

const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'success', label: 'Sẵn sàng' },
  Issued: { tone: 'warn', label: 'Chờ điều phối' },
  Delivering: { tone: 'warn', label: 'Đang giao hàng' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

export function ShipmentOperations({ orderId, sort, warehouseId }: { orderId: string; sort: ShipmentSort; warehouseId?: string }) {
  const { user } = useAuth();
  const mayDispatch = hasOperation(user, 'api:Shipments.Assign');
  const mayStart = hasOperation(user, 'api:Shipments.Dispatch');
  const mayIssue = hasOperation(user, 'api:Shipments.ConfirmIssue');
  const mayResolve = hasOperation(user, 'api:Shipments.ResolveException');
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
  const busyAssignments = useQuery({ queryKey: ['shipments', 'busy-assignments'], queryFn: shipmentsApi.busyAssignments, enabled: mayDispatch, refetchInterval: 15000 });

  if (shipments.isPending) return <p className="muted small">Đang tải thao tác vận hành…</p>;
  if (shipments.isError) return <Callout tone="danger">Không tải được phiếu giao hàng của đơn.\n{errorMessage(shipments.error)}</Callout>;
  const visibleShipments = (shipments.data ?? []).filter(item => !warehouseId || item.warehouseId === warehouseId);
  if (!visibleShipments.length) return <p className="muted small">Chưa có phiếu giao hàng được tạo cho đơn này.</p>;

  return (
    <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      {mayDispatch && (drivers.isPending || vehicles.isPending || busyAssignments.isPending) && <p className="muted small">Đang kiểm tra tài xế, xe và chuyến đang hoạt động…</p>}
      {mayDispatch && (drivers.isError || vehicles.isError || busyAssignments.isError) && <Callout tone="danger">
        Không tải đầy đủ tài xế, xe hoặc trạng thái chuyến đang hoạt động.\n{errorMessage(drivers.error ?? vehicles.error ?? busyAssignments.error)} <Button size="sm" onClick={() => { void drivers.refetch(); void vehicles.refetch(); void busyAssignments.refetch(); }}>Thử lại</Button>
      </Callout>}
      {[...visibleShipments].sort((a, b) => (sort === 'asc' ? 1 : -1) * a.shipmentCode.localeCompare(b.shipmentCode, 'vi', { numeric: true })).map((shipment) => (
        <ShipmentActionRow
          key={shipment.id}
          shipment={shipment}
          mayDispatch={mayDispatch}
          mayStartDelivery={mayStart}
          mayResolve={mayResolve}
          mayIssue={mayIssue}
          drivers={drivers.data ?? []}
          vehicles={vehicles.data ?? []}
          busyDriverIds={busyAssignments.data?.busyDriverIds ?? new Set<string>()}
          busyVehicleIds={busyAssignments.data?.busyVehicleIds ?? new Set<string>()}
          // Do not offer the first active vehicle before the active-delivery /
          // transfer query has finished. That short race used to send a busy
          // resource to the command endpoint and produce a 409 conflict.
          assignmentLoaded={drivers.isSuccess && vehicles.isSuccess && busyAssignments.isSuccess}
        />
      ))}
    </div>
  );
}

export function ShipmentActionRow({
  shipment,
  mayDispatch,
  mayStartDelivery = mayDispatch,
  mayResolve = mayDispatch,
  mayIssue = false,
  drivers,
  vehicles,
  assignmentLoaded = true,
  busyDriverIds = new Set<string>(),
  busyVehicleIds = new Set<string>(),
}: {
  shipment: Shipment;
  mayDispatch: boolean;
  mayStartDelivery?: boolean;
  mayResolve?: boolean;
  mayIssue?: boolean;
  drivers: DeliveryDriver[];
  vehicles: DeliveryVehicle[];
  assignmentLoaded?: boolean;
  busyDriverIds?: Set<string>;
  busyVehicleIds?: Set<string>;
}) {
  const warehouseDrivers = drivers.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId && !busyDriverIds.has(item.id));
  const warehouseVehicles = vehicles.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId && item.capacity >= shipment.totalQuantity && !busyVehicleIds.has(item.id));
  const [driverId, setDriverId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [resolutionReason, setResolutionReason] = useState('');
  const resolve = useApiMutation(shipmentsApi.resolveException, { success: 'Đã xử lý ngoại lệ và cập nhật trạng thái đơn.', onSuccess: () => setResolutionReason('') });
  const selectedDriver = driverId === null
    ? warehouseDrivers.find(item => item.id === shipment.driverId) ?? warehouseDrivers[0]
    : warehouseDrivers.find(item => item.id === driverId);
  const selectedVehicle = vehicleId === null
    ? warehouseVehicles.find(item => item.id === shipment.vehicleId) ?? warehouseVehicles[0]
    : warehouseVehicles.find(item => item.id === vehicleId);
  const issue = useApiMutation(shipmentsApi.issue, { success: 'Đã xác nhận phiếu giao hàng rời kho; tồn thực tế đã được trừ.' });
  const assign = useApiMutation(async (input: Parameters<typeof shipmentsApi.assign>[0]) => {
    const assigned = await shipmentsApi.assign(input);
    return mayStartDelivery && assigned.status === 'Issued' ? shipmentsApi.dispatch(assigned) : assigned;
  }, { success: mayStartDelivery ? 'Đã điều phối xe, tài xế và bắt đầu giao hàng.' : 'Đã gán tài xế và xe.' });
  const dispatch = useApiMutation(shipmentsApi.dispatch, { success: 'Phiếu giao hàng đã bắt đầu giao; tem đã chuyển InTransit.' });

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
        <strong>{shipment.shipmentCode} · {shipment.warehouseCode}</strong>
        <Chip tone={PART_STATUS[shipment.status]?.tone ?? 'neutral'}>
          {PART_STATUS[shipment.status]?.label ?? shipment.status}
        </Chip>
        {shipment.driverName && <span>{shipment.driverName} · {shipment.plateNumber}</span>}
      </div>

      {mayIssue && shipment.status === 'Ready' && (
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

      {shipment.status === 'Exception' && mayResolve && <div className="stack" style={{ marginTop: 8 }}>
        {shipment.exceptionReason && <Callout tone="danger">{shipment.exceptionReason}</Callout>}
        <Input aria-label="Kết quả xử lý ngoại lệ" placeholder="Nhập lý do / kết quả xử lý" value={resolutionReason} onChange={e => setResolutionReason(e.target.value)} />
        <Button size="sm" loading={resolve.isPending} disabled={!resolutionReason.trim() || resolutionReason.trim().length > 1000}
          onClick={() => resolve.mutate({ shipment, reason: resolutionReason })}>Hoàn tất xử lý ngoại lệ</Button>
      </div>}

      {shipment.status === 'Issued' && mayDispatch && (
        <div className="row-wrap" style={{ gap: 8, marginTop: 8 }}>
          <Select
            value={selectedDriver?.id ?? ''}
            disabled={!assignmentLoaded || assign.isPending || dispatch.isPending}
            aria-label={`Tài xế cho ${shipment.shipmentCode}`}
            onChange={(event) => setDriverId(event.target.value)}
            placeholder="Chọn tài xế"
            options={warehouseDrivers.map((item) => ({ value: item.id, label: `${item.code} · ${item.fullName}` }))}
          />
          <Select
            value={selectedVehicle?.id ?? ''}
            disabled={!assignmentLoaded || assign.isPending || dispatch.isPending}
            aria-label={`Xe cho ${shipment.shipmentCode}`}
            onChange={(event) => setVehicleId(event.target.value)}
            placeholder="Chọn xe"
            options={warehouseVehicles.map((item) => ({ value: item.id, label: `${item.plateNumber} · ${formatNumber(item.capacity)} thùng` }))}
          />
          <Button
            size="sm"
            loading={assign.isPending}
            disabled={!assignmentLoaded || !selectedDriver || !selectedVehicle || dispatch.isPending}
            onClick={() => {
              if (selectedDriver && selectedVehicle) assign.mutate({ shipment, driverId: selectedDriver.id, vehicleId: selectedVehicle.id });
            }}
          >
            {shipment.driverId && shipment.vehicleId ? 'Cập nhật xe & tài xế' : 'Gán xe & tài xế'}
          </Button>
          {assignmentLoaded && warehouseVehicles.length === 0 && <span className="muted small">Kho chưa có xe đang hoạt động đủ tải cho {formatNumber(shipment.totalQuantity)} thùng.</span>}
        </div>
      )}

      {shipment.status === 'Issued' && mayStartDelivery && shipment.driverId && shipment.vehicleId && (
        <Button
          size="sm"
          variant="primary"
          loading={dispatch.isPending}
          disabled={assign.isPending}
          onClick={() => dispatch.mutate(shipment)}
          style={{ marginTop: 8 }}
        >
          Bắt đầu giao
        </Button>
      )}
    </div>
  );
}
