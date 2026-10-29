import { get, getAll, patch, post, put } from '@/shared/api/http';
import { graphql } from '@/shared/api/graphql';
import { env } from '@/shared/lib';
import type {
  RetailerDistance,
  Warehouse,
  WarehouseDetail,
  WarehouseInput,
  WarehouseInventoryItem,
  WarehouseKeeperOption,
  WarehouseStatus,
  WarehouseType,
} from './types';

interface RawWarehouse {
  id?: string;
  warehouseId?: string;
  code?: string;
  warehouseCode?: string;
  name?: string;
  warehouseName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  type?: string;
  warehouseType?: string;
  keeperId?: string | null;
  keeperUserId?: string | null;
  keeperName?: string | null;
  warehouseKeeperName?: string | null;
  capacityPallets?: number;
  capacity?: number;
  minStock?: number;
  minStockPerSku?: number;
  minRegionalStock?: number;
  isActive?: boolean;
  status?: string;
  batchCount?: number;
  inventory?: RawInventoryItem[];
  batches?: RawInventoryItem[];
  retailerDistances?: RawRetailerDistance[];
}

interface RawInventoryItem {
  id?: string;
  batchId?: string;
  code?: string;
  batchCode?: string;
  sku?: string;
  productCode?: string;
  productName?: string;
  expiry?: string;
  expiryDate?: string;
  onHand?: number;
  quantityOnHand?: number;
  held?: number;
  quantityReserved?: number;
  reserved?: number;
  available?: number;
  quantityAvailable?: number;
  remainingDays?: number;
  expiryStatus?: 'Normal' | 'NearExpiry' | 'Expired' | 'Disposed';
}

interface RawRetailerDistance {
  retailerId?: string;
  retailerCode?: string;
  code?: string;
  retailerName?: string;
  name?: string;
  lat?: number;
  lng?: number;
  km?: number;
  distanceKm?: number;
  distanceMeters?: number;
  transitDays?: number | null;
  estimatedCost?: number | null;
  withinRange?: boolean;
}

const WAREHOUSES_QUERY = `
  query Warehouses($includeInactive: Boolean) {
    warehouses(includeInactive: $includeInactive) {
      id
      code
      name
      address
      latitude
      longitude
      warehouseType
      capacityPallets
      minStockPerSku
      isActive
    }
  }
`;

const WAREHOUSE_DETAIL_WITH_INV_QUERY = `
  query WarehouseDetailWithInv($id: UUID!) {
    warehouse(id: $id) {
      id
      code
      name
      address
      latitude
      longitude
      warehouseType
      capacityPallets
      minStockPerSku
      isActive
      inventory {
        batchId
        batchCode
        productCode
        productName
        expiryDate
        quantityOnHand
        quantityReserved
        quantityAvailable
      }
    }
  }
`;

const WAREHOUSE_DETAIL_BASIC_QUERY = `
  query WarehouseDetailBasic($id: UUID!) {
    warehouse(id: $id) {
      id
      code
      name
      address
      latitude
      longitude
      warehouseType
      capacityPallets
      minStockPerSku
      isActive
    }
  }
`;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeType(raw: RawWarehouse): WarehouseType {
  const t = String(raw.type ?? raw.warehouseType ?? 'Regional').toLowerCase();
  if (t === 'central' || t.includes('tổng') || t === '1') return 'Central';
  return 'Regional';
}

function normalizeStatus(raw: RawWarehouse): WarehouseStatus {
  if (typeof raw.isActive === 'boolean') return raw.isActive ? 'Active' : 'Paused';
  if (raw.status === 'Paused' || raw.status === 'Inactive' || raw.status === 'Locked') return 'Paused';
  return 'Active';
}

function normalizeInventoryItem(raw: RawInventoryItem): WarehouseInventoryItem {
  const available = Number(raw.available ?? raw.quantityAvailable ?? 0);
  const held = Number(raw.held ?? raw.reserved ?? raw.quantityReserved ?? 0);
  const onHand = Number(raw.onHand ?? raw.quantityOnHand ?? available + held);
  const expiry = String(raw.expiry ?? raw.expiryDate ?? '').slice(0, 10);
  let remainingDays = raw.remainingDays;
  if (remainingDays === undefined && expiry) {
    const diff = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    if (Number.isFinite(diff)) remainingDays = diff;
  }
  const expiryStatus: WarehouseInventoryItem['expiryStatus'] =
    raw.expiryStatus ??
    (remainingDays !== undefined
      ? remainingDays <= 0
        ? 'Expired'
        : remainingDays <= 10
          ? 'NearExpiry'
          : 'Normal'
      : 'Normal');

  return {
    id: raw.id ?? raw.batchId,
    code: String(raw.code ?? raw.batchCode ?? '—'),
    sku: String(raw.sku ?? raw.productCode ?? '—'),
    productName: String(raw.productName ?? raw.sku ?? raw.productCode ?? '—'),
    expiry,
    onHand,
    held,
    available,
    remainingDays,
    expiryStatus,
  };
}

function normalizeWarehouse(raw: RawWarehouse): Warehouse {
  const type = normalizeType(raw);
  const status = normalizeStatus(raw);
  const invList = raw.inventory ?? raw.batches;
  const minStockVal = Number(raw.minStock ?? raw.minStockPerSku ?? raw.minRegionalStock);
  return {
    id: raw.id ?? raw.warehouseId,
    code: String(raw.code ?? raw.warehouseCode ?? ''),
    name: String(raw.name ?? raw.warehouseName ?? ''),
    address: String(raw.address ?? ''),
    lat: Number(raw.lat ?? raw.latitude ?? 0),
    lng: Number(raw.lng ?? raw.longitude ?? 0),
    type,
    keeperId: raw.keeperId ?? raw.keeperUserId ?? null,
    keeperName: raw.keeperName ?? raw.warehouseKeeperName ?? null,
    capacityPallets: Number(raw.capacityPallets ?? raw.capacity ?? 0),
    minStock: !Number.isNaN(minStockVal) && minStockVal > 0 ? minStockVal : type === 'Central' ? 80 : 30,
    isActive: status === 'Active',
    status,
    batchCount: typeof raw.batchCount === 'number' ? raw.batchCount : Array.isArray(invList) ? invList.length : 0,
  };
}

/** Road distance estimate (Haversine * 1.3 road factor, matching prototype roadKm) */
export function estimateRoadKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(straight * 1.3 * 10) / 10;
}

function quoteRetailerTransit(
  km: number,
  dmaxKm = 20,
  bands: { fromKm: number; toKm: number; days: number; cost: number }[] = [
    { fromKm: 0, toKm: 10, days: 1, cost: 300000 },
    { fromKm: 10, toKm: 20, days: 2, cost: 500000 },
  ],
): { days: number; cost: number } | null {
  if (km > dmaxKm) return null;
  const matched =
    bands.find((b) => km >= b.fromKm && km <= b.toKm) ??
    bands[bands.length - 1];
  return matched ? { days: matched.days, cost: matched.cost } : { days: km <= 10 ? 1 : 2, cost: km <= 10 ? 300000 : 500000 };
}

const codeToIdMap = new Map<string, string>();
const keeperOverrideMap = new Map<string, { keeperId: string | null; keeperName: string | null }>();
const minStockOverrideMap = new Map<string, number>();

function rememberWarehouse(w: Warehouse): Warehouse {
  if (w.code && w.id) codeToIdMap.set(w.code.toUpperCase(), w.id);
  const keeperOv = keeperOverrideMap.get(w.code.toUpperCase());
  if (keeperOv) {
    w.keeperId = keeperOv.keeperId;
    w.keeperName = keeperOv.keeperName;
  }
  const minOv = minStockOverrideMap.get(w.code.toUpperCase());
  if (minOv !== undefined) {
    w.minStock = minOv;
  }
  return w;
}

async function resolveWarehouseId(idOrCode: string): Promise<string> {
  if (isUuid(idOrCode)) return idOrCode;
  const cached = codeToIdMap.get(idOrCode.toUpperCase());
  if (cached && isUuid(cached)) return cached;
  const all = await warehouseApi.list();
  const found = all.find(
    (w) => w.code.toUpperCase() === idOrCode.toUpperCase() || w.id === idOrCode,
  );
  if (found?.id) {
    codeToIdMap.set(found.code.toUpperCase(), found.id);
    return found.id;
  }
  return idOrCode;
}

async function enrichKeepersFromUsers(warehouses: Warehouse[]): Promise<Warehouse[]> {
  if (warehouses.every((w) => w.keeperName)) return warehouses;
  try {
    const keepers = await warehouseApi.listKeepers();
    if (!keepers.length) return warehouses;
    return warehouses.map((w) => {
      if (w.keeperName) return w;
      const matched = keepers.find(
        (k) =>
          k.scope &&
          (k.scope.toLowerCase().includes(w.code.toLowerCase()) ||
            k.scope.toLowerCase().includes(w.name.toLowerCase()) ||
            (w.id && k.scope.toLowerCase().includes(w.id.toLowerCase()))),
      );
      if (matched) {
        return { ...w, keeperId: matched.id, keeperName: matched.name };
      }
      return w;
    });
  } catch {
    return warehouses;
  }
}

export const warehouseApi = {
  async list(): Promise<Warehouse[]> {
    if (!env.useMock) {
      try {
        const data = await graphql<{ warehouses: RawWarehouse[] }>(WAREHOUSES_QUERY, {
          includeInactive: true,
        });
        if (Array.isArray(data?.warehouses)) {
          const items = data.warehouses.map(normalizeWarehouse).map(rememberWarehouse);
          return enrichKeepersFromUsers(items);
        }
      } catch {
        // Fallback to REST GET /api/v1/warehouses
      }
    }
    const res = await getAll<RawWarehouse>('/warehouses', {
      includeInactive: true,
    });
    const items = res.map(normalizeWarehouse).map(rememberWarehouse);
    return enrichKeepersFromUsers(items);
  },

  async get(idOrCode: string, canViewInventory = true): Promise<WarehouseDetail> {
    let rawDetail: RawWarehouse | null = null;

    if (!env.useMock) {
      const targetId = await resolveWarehouseId(idOrCode);
      if (isUuid(targetId)) {
        if (canViewInventory) {
          try {
            const data = await graphql<{ warehouse: RawWarehouse | null }>(
              WAREHOUSE_DETAIL_WITH_INV_QUERY,
              { id: targetId },
            );
            if (data?.warehouse) rawDetail = data.warehouse;
          } catch {
            // Fallback to basic query or REST
          }
        }
        if (!rawDetail) {
          try {
            const data = await graphql<{ warehouse: RawWarehouse | null }>(
              WAREHOUSE_DETAIL_BASIC_QUERY,
              { id: targetId },
            );
            if (data?.warehouse) rawDetail = data.warehouse;
          } catch {
            // Fallback to REST
          }
        }
      }
      if (!rawDetail) {
        try {
          rawDetail = await get<RawWarehouse>(`/warehouses/${targetId}`);
        } catch {
          const all = await warehouseApi.list();
          const matched = all.find(
            (w) => w.code.toUpperCase() === idOrCode.toUpperCase() || w.id === idOrCode,
          );
          if (matched) rawDetail = matched;
        }
      }
    } else {
      rawDetail = await get<RawWarehouse>(`/warehouses/${idOrCode}`);
    }

    if (!rawDetail) {
      throw new Error(`Không tìm thấy kho ${idOrCode}`);
    }

    const baseList = await enrichKeepersFromUsers([rememberWarehouse(normalizeWarehouse(rawDetail))]);
    const base = baseList[0];

    // 1. Inventory batches
    let inventory: WarehouseInventoryItem[] = Array.isArray(rawDetail.inventory ?? rawDetail.batches)
      ? (rawDetail.inventory ?? rawDetail.batches ?? []).map(normalizeInventoryItem)
      : [];

    if (inventory.length === 0 && canViewInventory) {
      try {
        const batchRes = await getAll<RawInventoryItem>('/batches', {
          warehouse: base.code,
          warehouseId: base.id,
        });
        inventory = batchRes.map(normalizeInventoryItem);
      } catch {
        // Ignore if batches endpoint is not available for role
      }
    }

    const batchCount = base.batchCount || inventory.length;

    // 2. Retailer road distances & transit table quote
    let transitTableVersion = 1;
    let dmaxRetailerKm = 20;
    let bands = [
      { fromKm: 0, toKm: 10, days: 1, cost: 300000 },
      { fromKm: 10, toKm: 20, days: 2, cost: 500000 },
    ];

    try {
      const ttRes = await get<{
        version?: number;
        maxServingDistanceMeters?: number;
        bands?: {
          minDistanceMeters: number;
          maxDistanceMeters: number;
          transitMinutes: number;
          estimatedCostAmount: number;
        }[];
      }>('/transit-tables/active');
      if (ttRes) {
        if (ttRes.version) transitTableVersion = ttRes.version;
        if (ttRes.maxServingDistanceMeters) {
          dmaxRetailerKm = Math.round(ttRes.maxServingDistanceMeters / 1000);
        }
        if (Array.isArray(ttRes.bands) && ttRes.bands.length > 0) {
          bands = ttRes.bands.map((b) => ({
            fromKm: b.minDistanceMeters / 1000,
            toKm: b.maxDistanceMeters / 1000,
            days: Math.max(1, Math.round(b.transitMinutes / 1440)),
            cost: b.estimatedCostAmount,
          }));
        }
      }
    } catch {
      // Keep default active transit table settings
    }

    let retailerDistances: RetailerDistance[] = [];
    if (Array.isArray(rawDetail.retailerDistances) && rawDetail.retailerDistances.length > 0) {
      retailerDistances = rawDetail.retailerDistances.map((r) => {
        const km =
          typeof r.km === 'number'
            ? r.km
            : typeof r.distanceKm === 'number'
              ? r.distanceKm
              : typeof r.distanceMeters === 'number'
                ? Math.round((r.distanceMeters / 1000) * 10) / 10
                : 0;
        const quote = quoteRetailerTransit(km, dmaxRetailerKm, bands);
        return {
          retailerId: r.retailerId,
          retailerCode: String(r.retailerCode ?? r.code ?? ''),
          retailerName: String(r.retailerName ?? r.name ?? ''),
          lat: r.lat,
          lng: r.lng,
          km,
          transitDays: r.transitDays !== undefined ? r.transitDays : (quote?.days ?? null),
          estimatedCost: r.estimatedCost !== undefined ? r.estimatedCost : (quote?.cost ?? null),
          withinRange: r.withinRange !== undefined ? r.withinRange : km <= dmaxRetailerKm,
        };
      });
    } else {
      try {
        const retailers = await getAll<{
          id?: string;
          code?: string;
          retailerCode?: string;
          name?: string;
          lat?: number;
          lng?: number;
          latitude?: number;
          longitude?: number;
        }>('/retailers');
        retailerDistances = retailers.map((r) => {
          const rLat = Number(r.lat ?? r.latitude ?? 10.87);
          const rLng = Number(r.lng ?? r.longitude ?? 106.65);
          const km = estimateRoadKm(base.lat, base.lng, rLat, rLng);
          const quote = quoteRetailerTransit(km, dmaxRetailerKm, bands);
          return {
            retailerId: r.id,
            retailerCode: String(r.code ?? r.retailerCode ?? ''),
            retailerName: String(r.name ?? ''),
            lat: rLat,
            lng: rLng,
            km,
            transitDays: quote?.days ?? null,
            estimatedCost: quote?.cost ?? null,
            withinRange: !!quote,
          };
        });
      } catch {
        retailerDistances = [];
      }
    }

    return {
      ...base,
      batchCount,
      inventory,
      retailerDistances,
      transitTableVersion,
      dmaxRetailerKm,
    };
  },

  async create(body: WarehouseInput): Promise<Warehouse> {
    const codeUpper = body.code.trim().toUpperCase();
    minStockOverrideMap.set(codeUpper, body.minStock);
    if (body.keeperName || body.keeperId) {
      keeperOverrideMap.set(codeUpper, {
        keeperId: body.keeperId ?? null,
        keeperName: body.keeperName ?? null,
      });
    }

    const payload = {
      ...body,
      code: codeUpper,
      warehouseType: body.type,
      latitude: body.lat,
      longitude: body.lng,
      minStockPerSku: body.minStock,
      isActive: body.status === 'Active',
    };

    const res = await post<RawWarehouse>('/warehouses', payload);
    const created = rememberWarehouse(normalizeWarehouse({ ...payload, ...res }));

    if (!env.useMock && body.keeperId && created.id && isUuid(body.keeperId) && isUuid(created.id)) {
      try {
        await put(`/users/${body.keeperId}/scope/warehouses/${created.id}`);
      } catch {
        // Ignore if scope endpoint is handled differently
      }
    }

    return created;
  },

  async update(idOrCode: string, body: WarehouseInput): Promise<Warehouse> {
    const codeUpper = body.code.trim().toUpperCase();
    minStockOverrideMap.set(codeUpper, body.minStock);
    keeperOverrideMap.set(codeUpper, {
      keeperId: body.keeperId ?? null,
      keeperName: body.keeperName ?? null,
    });

    const target = env.useMock ? idOrCode : await resolveWarehouseId(idOrCode);
    const payload = {
      ...body,
      code: codeUpper,
      warehouseType: body.type,
      latitude: body.lat,
      longitude: body.lng,
      minStockPerSku: body.minStock,
      isActive: body.status === 'Active',
    };

    const res = await put<RawWarehouse>(`/warehouses/${target}`, payload);
    const updated = rememberWarehouse(
      normalizeWarehouse({ ...payload, ...res, id: isUuid(target) ? target : res?.id }),
    );

    if (!env.useMock && body.keeperId && isUuid(body.keeperId) && isUuid(target)) {
      try {
        await put(`/users/${body.keeperId}/scope/warehouses/${target}`);
      } catch {
        // Ignore if already assigned
      }
    }

    return updated;
  },

  async updateStatus(idOrCode: string, isActive: boolean): Promise<Warehouse> {
    const target = env.useMock ? idOrCode : await resolveWarehouseId(idOrCode);
    const res = await patch<RawWarehouse>(`/warehouses/${target}/status`, {
      isActive,
      status: isActive ? 'Active' : 'Paused',
    });
    return rememberWarehouse(
      normalizeWarehouse({
        ...res,
        id: isUuid(target) ? target : res?.id,
        code: res?.code ?? idOrCode,
        isActive,
        status: isActive ? 'Active' : 'Paused',
      }),
    );
  },

  async listKeepers(): Promise<WarehouseKeeperOption[]> {
    try {
      const users = await getAll<{
        id?: string;
        userId?: string;
        name?: string;
        fullName?: string;
        loginName?: string;
        email?: string;
        role?: string;
        roles?: string[];
        scope?: string;
      }>('/users');
      const keepers = users
        .filter((u) => {
          const role = u.role ?? (Array.isArray(u.roles) ? u.roles[0] : '');
          return (
            role === 'WarehouseKeeper' ||
            String(role).toLowerCase().includes('keeper') ||
            String(role).toLowerCase().includes('thủ kho')
          );
        })
        .map((u) => ({
          id: String(u.id ?? u.userId ?? u.loginName ?? u.name ?? ''),
          name: String(u.name ?? u.fullName ?? u.loginName ?? ''),
          loginName: u.loginName ?? u.email,
          scope: u.scope,
        }));
      if (keepers.length > 0) return keepers;
    } catch {
      // Fallback to default keepers list when non-Admin or endpoint unavailable
    }
    return [
      { id: 'Đỗ Văn Tâm', name: 'Đỗ Văn Tâm', scope: 'Kho Thới An' },
      { id: 'Ngô Thị Lan', name: 'Ngô Thị Lan', scope: 'Kho Tân Chánh Hiệp' },
      { id: 'Bùi Quang Minh', name: 'Bùi Quang Minh', scope: 'Kho Gò Vấp' },
      { id: 'Lý Hoàng Nam', name: 'Lý Hoàng Nam', scope: 'Kho Thủ Đức' },
      { id: 'Trịnh Văn Hậu', name: 'Trịnh Văn Hậu', scope: 'Kho Củ Chi' },
      { id: 'Võ Thanh Hải', name: 'Võ Thanh Hải', scope: 'Kho Cần Giờ' },
    ];
  },

  async getRetailerMapPoints(): Promise<{ code: string; name: string; address: string; lat: number; lng: number }[]> {
    try {
      const retailers = await getAll<{
        code?: string;
        retailerCode?: string;
        name?: string;
        address?: string;
        lat?: number;
        lng?: number;
        latitude?: number;
        longitude?: number;
      }>('/retailers');
      return retailers.map((r) => ({
        code: String(r.code ?? r.retailerCode ?? ''),
        name: String(r.name ?? ''),
        address: String(r.address ?? ''),
        lat: Number(r.lat ?? r.latitude ?? 10.87),
        lng: Number(r.lng ?? r.longitude ?? 106.65),
      }));
    } catch {
      return [];
    }
  },
};
