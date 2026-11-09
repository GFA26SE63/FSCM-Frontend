import { env } from '@/shared/lib';
/* The order API accepts both the current backend contract and older demo snapshots. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, getAll, post, http } from '@/shared/api/http';
import type { DispatchShipment, DispatchDriver, DispatchVehicle, OrderDetail, OrderPrice, OrderSummary, OrderTraceDetail } from './types';

function normalizeSummary(o: any): OrderSummary {
  const lineCount = o.lineCount ?? (o.lines ? o.lines.length : 0);
  const totalCartons = o.totalCartons ?? (o.lines ? o.lines.reduce((s: number, l: any) => s + (l.qty ?? l.quantity ?? 0), 0) : 0);
  const itemsSummary = o.itemsSummary ?? (lineCount > 0 ? `${lineCount} dòng · ${totalCartons} thùng` : '0 dòng');

  return {
    code: o.code ?? o.orderCode ?? '',
    retailerCode: o.retailerCode ?? '',
    retailerName: o.retailerName ?? '',
    itemsSummary,
    salesName: o.createdByUserName ?? o.salesName ?? 'Chưa xác định',
    createdAt: o.createdAt ?? new Date().toISOString(),
    channel: (o.channel ?? (o.source === 'Offline' ? 'Offline' : 'Online')) as 'Online' | 'Offline',
    total: o.total ?? o.finalAmount ?? 0,
    status: (o.status === 'PendingApproval' || o.status === 'PendingAllocation' ? 'Pending' : o.status) as any,
    paymentMethod: o.paymentMethod ?? 'Prepaid',
    termDays: o.termDays ?? o.creditTermDays ?? null,
  };
}

function normalizeDetail(o: any): OrderDetail {
  const summary = normalizeSummary(o);
  const lines = (o.lines ?? []).map((l: any, idx: number) => ({
    no: l.no ?? l.lineNumber ?? (idx + 1),
    sku: l.sku ?? '',
    name: l.name ?? l.productName ?? '',
    unitPrice: l.unitPrice ?? 0,
    qty: l.qty ?? l.quantity ?? 0,
    promotionCode: l.promotionCode ?? l.ordinaryPromotion?.code ?? l.discountSourceCode ?? null,
    promotionPct: l.promotionPct ?? l.ordinaryPromotion?.discountPercent ?? l.discountPercent ?? 0,
    discount: l.discount ?? l.discountAmount ?? 0,
    lineTotal: l.lineTotal ?? l.netAmount ?? ((l.unitPrice ?? 0) * (l.qty ?? l.quantity ?? 0)),
    mlor: {
      sourceScope: l.mlor?.sourceScope ?? 'Default',
      minimumLifeRatio: l.mlor?.minimumLifeRatio ?? 0,
      minimumLifeHours: l.mlor?.minimumLifeHours ?? null,
      resolvedAt: l.mlor?.resolvedAt ?? o.createdAt ?? new Date().toISOString(),
    },
    finalPricePendingAllocation: l.finalPricePendingAllocation ?? false,
  }));

  const rawAllocations = (o.allocations && o.allocations.length > 0)
    ? o.allocations
    : (o.lines ?? []).flatMap((l: any) => (l.allocations ?? []).map((a: any) => ({
        warehouseCode: a.warehouseCode ?? '',
        warehouseName: a.warehouseName ?? a.warehouseCode ?? '',
        sku: l.sku ?? '',
        batchCode: a.batchCode ?? '',
        expiry: a.estimatedArrivalAt ?? '',
        km: (a.distanceMeters ?? 0) / 1000,
        eta: a.estimatedArrivalAt ?? '',
        remainingDays: Math.round((a.remainingLifeHoursAtArrival ?? 0) / 24),
        qty: a.quantity ?? 0,
        score: a.weightedScore ?? 0,
      })));

  const timeline = (o.history && o.history.length > 0)
    ? o.history.map((h: any) => ({
        at: h.changedAt,
        label: h.reason ? `${h.toStatus}: ${h.reason}` : h.toStatus,
      }))
    : (o.timeline ?? [{ at: o.createdAt ?? new Date().toISOString(), label: 'Tạo đơn' }]);

  return {
    ...summary,
    id: o.id ?? '',
    retailerAddress: o.retailerAddress ?? o.deliveryAddress ?? '',
    groupCode: o.groupCode ?? o.salesGroupId ?? '',
    areaName: o.areaName ?? 'Khu vực TP.HCM',
    syncedAt: o.syncedAt ?? null,
    syncMode: o.syncMode ?? null,
    prepaidChannel: o.prepaidChannel ?? null,
    paymentStatus: o.paymentStatus ?? (o.paymentMethod === 'Credit' ? 'Chưa thu' : 'Đã thanh toán'),
    receivable: o.receivable ?? null,
    reviewer: o.reviewer ?? (o.reviewedByUserId ? 'Quản lý bán hàng' : ''),
    rejectReason: o.rejectReason ?? o.rejectionReason ?? null,
    cancelReason: o.cancelReason ?? null,
    promoChange: o.promoChange ?? null,
    lines,
    promotions: o.promotions ?? [],
    totalBeforePromo: o.totalBeforePromo ?? o.subtotalAmount ?? summary.total,
    discount: o.discount ?? o.discountAmount ?? 0,
    finalPrice: o.finalPrice ?? o.finalAmount ?? summary.total,
    totalQty: lines.reduce((sum: number, l: any) => sum + l.qty, 0),
    allocationState: o.allocationState ?? 'Held',
    allocations: rawAllocations,
    estimatedDeliveryCost: o.estimatedDeliveryCost ?? null,
    delivery: o.delivery ?? null,
    loyalty: o.loyalty ?? { points: 0, state: 'None' },
    pickingLists: o.pickingLists ?? (o.warehouseProgress ? o.warehouseProgress.filter((p: any) => p.pickingCode).map((p: any) => ({ code: p.pickingCode, warehouseName: p.warehouseCode })) : []),
    timeline,
  };
}

export const orderApi = {
  shipments: (orderId: string) => get<DispatchShipment[]>('/shipments', { orderId }),
  list: () => getAll<any>('/orders').then((items) => items.map(normalizeSummary)),
  get: (code: string) => get<any>(`/orders/${code}`).then(normalizeDetail),
  /** The price the run settled on, component by component. Keyed by identifier, like the trace. */
  price: (orderId: string) => get<OrderPrice>(`/allocation-runs/orders/${orderId}/price`),
  /** Why the run chose these batches. The price those batches ended at is a separate record (F98). */
  trace: (orderId: string) => get<OrderTraceDetail>(`/allocation-runs/orders/${orderId}/trace`),
  approve: async (code: string) => {
    const current = await get<any>(`/orders/${code}`);
    return normalizeDetail(await post<any>(`/orders/${code}/approve`, { expectedVersion: current.version }));
  },
  reject: async (v: { code: string; reason: string }) => {
    const current = await get<any>(`/orders/${v.code}`);
    return normalizeDetail(await post<any>(`/orders/${v.code}/reject`, { expectedVersion: current.version, reason: v.reason }));
  },
  cancel: async (v: { code: string; reason: string }) => {
    const current = await get<any>(`/orders/${v.code}`);
    return normalizeDetail(await post<any>(`/orders/${v.code}/cancel`, { expectedVersion: current.version, reason: v.reason }));
  },
  /** Operator picks vehicle + driver from the master-data dropdowns; the order keeps a snapshot. */
  dispatch: async (v: { code: string; plate: string; driverCode: string; shipmentId?: string }) => {
    const [order, vehicles, drivers] = await Promise.all([
      get<any>(`/orders/${v.code}`),
      getAll<any>('/deliveries/vehicles'),
      getAll<any>('/deliveries/drivers'),
    ]);
    const vehicle = vehicles.find((x) => x.plateNumber === v.plate);
    const driver = drivers.find((x) => x.code === v.driverCode);
    if (!vehicle || !driver) throw new Error('Xe hoặc người giao không hợp lệ.');
    if (env.useMock) {
      await post(`/orders/${v.code}/dispatch`, { vehicleId: vehicle.id, driverId: driver.id, expectedOrderVersion: order.version, note: null });
    } else {
      const parts = await orderApi.shipments(order.id);
      const part = parts.find(p => p.id === v.shipmentId);
      if (!part) throw new Error('Chọn phần giao theo kho trước khi gán xe.');
      if (vehicle.warehouseId !== part.warehouseId || driver.warehouseId !== part.warehouseId)
        throw new Error('Xe và người giao phải thuộc kho của phần giao đã chọn.');
      if (vehicle.capacity < part.totalQuantity) throw new Error('Tải trọng xe không đủ cho phần giao này.');
      await http.patch(`/shipments/${part.id}/assignment`, { vehicleId: vehicle.id, driverId: driver.id, expectedVersion: part.version });
    }
    return normalizeDetail(await get<any>(`/orders/${v.code}`));
  },
  /** Normally done by the retailer in the mobile app (scan QR); exposed for the mock demo. */
  confirmReceipt: (v: { code: string; qrCodes: string[] }) => post<any>(`/orders/${v.code}/confirm-receipt`, { qrCodes: v.qrCodes }).then(r => normalizeDetail(r.order ?? r)),
  vehicles: async (): Promise<DispatchVehicle[]> => (await getAll<any>('/deliveries/vehicles')).map((v) => ({ warehouseId: v.warehouseId, plate: v.plateNumber, type: v.vehicleType, capacity: v.capacity, status: v.isActive ? 'Active' : 'Maintenance' })),
  drivers: async (): Promise<DispatchDriver[]> => (await getAll<any>('/deliveries/drivers')).map((d) => ({ warehouseId: d.warehouseId, code: d.code, name: d.fullName, phone: d.phone, status: d.isActive ? 'Active' : 'OnLeave' })),
};
