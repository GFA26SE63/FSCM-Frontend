import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Callout, Chip, Select, type Tone } from '@/shared/ui';
import { formatCases, formatInstantDateTime } from '@/shared/lib';
import { useAuth } from '@/shared/auth/AuthContext';
import { can } from '@/shared/auth/permissions';
import { useApiMutation } from '@/shared/hooks/useApiMutation';
import { useOrder } from '@/features/orders/hooks';
import type { OrderDetail } from '@/features/orders/types';
import { shipmentsApi } from '../api';
import type { DeliveryDriver, DeliveryVehicle, Shipment, ShipmentPartStatus } from '../types';

const PART_STATUS: Record<ShipmentPartStatus, { tone: Tone; label: string }> = {
  WaitingToPick: { tone: 'info', label: 'Chưa soạn xong' },
  Ready: { tone: 'info', label: 'Sẵn sàng xuất' },
  Issued: { tone: 'success', label: 'Đã xuất kho' },
  Delivering: { tone: 'warn', label: 'Đang giao' },
  Received: { tone: 'success', label: 'Đã nhận' },
  Exception: { tone: 'danger', label: 'Ngoại lệ' },
};

/** Backend accepts an assignment only while the part has not started delivering. */
export const canAssignShipment = (status: ShipmentPartStatus) => status === 'Ready' || status === 'Issued';

/**
 * Latest estimated arrival per warehouse, taken from the allocation snapshot of the order. The
 * shipment record itself carries no ETA, so this is the only server-side source; it is shown as an
 * estimate and never written back.
 */
export function etaByWarehouse(order: OrderDetail | undefined): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of order?.lines ?? []) {
    for (const fragment of line.allocationFragments ?? []) {
      if (!fragment.estimatedArrivalAt) continue;
      const current = result.get(fragment.warehouseId);
      if (!current || new Date(fragment.estimatedArrivalAt) > new Date(current)) {
        result.set(fragment.warehouseId, fragment.estimatedArrivalAt);
      }
    }
  }
  return result;
}

/**
 * F58: assign a vehicle and a driver to each warehouse part of an order.
 *
 * Assigning only records who delivers. It never issues stock and never starts delivery: those are
 * separate, clearly labelled actions below, because stock leaves the warehouse only on the
 * warehouse's own confirmation (F96).
 */
export function ShipmentAssignmentPanel({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const mayAssign = can(user, 'fleet.manage');
  const shipments = useQuery({
    queryKey: ['shipments', orderId],
    queryFn: () => shipmentsApi.list(orderId),
  });
  const drivers = useQuery({ queryKey: ['shipments', 'drivers'], queryFn: shipmentsApi.drivers, enabled: mayAssign });
  const vehicles = useQuery({ queryKey: ['shipments', 'vehicles'], queryFn: shipmentsApi.vehicles, enabled: mayAssign });
  const order = useOrder(orderId);
  const etas = useMemo(() => etaByWarehouse(order.data), [order.data]);

  if (shipments.isPending) return <p className="muted small">Đang tải phần giao theo kho…</p>;
  if (shipments.isError) return <Callout tone="danger">Không tải được phần giao của đơn.</Callout>;
  if (!shipments.data?.length) {
    return <Callout tone="info">Đơn chưa có phần giao nào. Phần giao được tạo khi từng kho đóng phiếu soạn.</Callout>;
  }

  const assigned = shipments.data.filter((item) => item.driverId && item.vehicleId).length;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p className="muted small" style={{ margin: 0 }}>
        Đã gán {assigned}/{shipments.data.length} phần giao. Gán xe và người giao không phải là xác nhận xuất kho.
      </p>
      {(drivers.isError || vehicles.isError) && (
        <Callout tone="danger">Không tải được danh sách xe hoặc người giao; chưa thể gán.</Callout>
      )}
      {shipments.data.map((shipment) => (
        <ShipmentCard
          key={`${shipment.id}:${shipment.version}`}
          shipment={shipment}
          eta={etas.get(shipment.warehouseId)}
          mayAssign={mayAssign}
          drivers={drivers.data ?? []}
          vehicles={vehicles.data ?? []}
        />
      ))}
    </div>
  );
}

function ShipmentCard({
  shipment,
  eta,
  mayAssign,
  drivers,
  vehicles,
}: {
  shipment: Shipment;
  eta: string | undefined;
  mayAssign: boolean;
  drivers: DeliveryDriver[];
  vehicles: DeliveryVehicle[];
}) {
  const status = PART_STATUS[shipment.status] ?? { tone: 'neutral' as Tone, label: shipment.status };
  const isAssigned = !!(shipment.driverId && shipment.vehicleId);
  const editable = mayAssign && canAssignShipment(shipment.status);
  const warehouseDrivers = drivers.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId);
  const warehouseVehicles = vehicles.filter((item) => item.isActive && item.warehouseId === shipment.warehouseId);
  const [driverId, setDriverId] = useState(shipment.driverId ?? '');
  const [vehicleId, setVehicleId] = useState(shipment.vehicleId ?? '');
  const selectedVehicle = warehouseVehicles.find((item) => item.id === vehicleId);
  const overCapacity = !!selectedVehicle && selectedVehicle.capacity < shipment.totalQuantity;
  const unchanged = driverId === (shipment.driverId ?? '') && vehicleId === (shipment.vehicleId ?? '');

  const assign = useApiMutation(shipmentsApi.assign, {
    success: 'Đã lưu xe và người giao. Chưa xuất kho và chưa bắt đầu giao.',
  });
  const issue = useApiMutation(shipmentsApi.issue, {
    success: 'Đã xác nhận phần giao rời kho; tồn thực tế đã được trừ.',
  });
  const dispatch = useApiMutation(shipmentsApi.dispatch, {
    success: 'Phần giao đã bắt đầu giao; tem đã chuyển InTransit.',
  });

  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
        <strong>
          {shipment.shipmentCode} · {shipment.warehouseName ?? shipment.warehouseCode}
        </strong>
        <Chip tone={status.tone}>{status.label}</Chip>
        <Chip tone={isAssigned ? 'ok' : 'warn'}>{isAssigned ? 'Đã gán xe' : 'Chưa gán xe'}</Chip>
      </div>

      <div className="muted small" style={{ marginTop: 6 }}>
        Tổng {formatCases(shipment.totalQuantity)} · Dự kiến tới{' '}
        {eta ? formatInstantDateTime(eta) : 'chưa có'}
        {isAssigned && (
          <>
            {' '}
            · {shipment.driverName} · {shipment.plateNumber}
            {shipment.driverPhone ? ` · ${shipment.driverPhone}` : ''}
          </>
        )}
      </div>

      <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {shipment.lines.map((line) => (
          <li key={`${line.orderLineId}:${line.batchId}`}>
            {line.sku} · batch {line.batchCode}: {formatCases(line.quantity)}
          </li>
        ))}
      </ul>

      {editable && (
        <div style={{ marginTop: 10 }}>
          <div className="row-wrap" style={{ gap: 8 }}>
            <Select
              value={driverId}
              onChange={(event) => setDriverId(event.target.value)}
              placeholder="Chọn người giao"
              options={warehouseDrivers.map((item) => ({
                value: item.id,
                label: `${item.code} · ${item.fullName}`,
              }))}
            />
            <Select
              value={vehicleId}
              onChange={(event) => setVehicleId(event.target.value)}
              placeholder="Chọn xe"
              options={warehouseVehicles.map((item) => {
                const tooSmall = item.capacity < shipment.totalQuantity;
                return {
                  value: item.id,
                  disabled: tooSmall,
                  label: `${item.plateNumber} · tải ${item.capacity} thùng${tooSmall ? ' (không đủ tải)' : ''}`,
                };
              })}
            />
            <Button
              size="sm"
              variant="primary"
              loading={assign.isPending}
              disabled={!driverId || !vehicleId || overCapacity || unchanged}
              onClick={() => assign.mutate({ shipment, driverId, vehicleId })}
            >
              {isAssigned ? 'Đổi xe / người giao' : 'Lưu gán xe & người giao'}
            </Button>
          </div>
          {warehouseDrivers.length === 0 || warehouseVehicles.length === 0 ? (
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              Kho này chưa có {warehouseDrivers.length === 0 ? 'người giao' : 'xe'} đang hoạt động. Thêm ở màn Xe &
              người giao.
            </p>
          ) : null}
        </div>
      )}

      {mayAssign && !editable && shipment.status !== 'Received' && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Phần giao đang ở trạng thái “{status.label}” nên không đổi được xe và người giao.
        </p>
      )}

      <div className="row-wrap" style={{ gap: 8, marginTop: 10 }}>
        {shipment.status === 'Ready' && (
          <Button size="sm" loading={issue.isPending} onClick={() => issue.mutate(shipment)}>
            Xác nhận xuất kho
          </Button>
        )}
        {shipment.status === 'Issued' && mayAssign && (
          <Button
            size="sm"
            variant="primary"
            loading={dispatch.isPending}
            disabled={!isAssigned}
            onClick={() => dispatch.mutate(shipment)}
          >
            Bắt đầu giao
          </Button>
        )}
        {shipment.status === 'Issued' && mayAssign && !isAssigned && (
          <span className="muted small">Cần gán xe và người giao trước khi bắt đầu giao.</span>
        )}
      </div>
    </div>
  );
}
