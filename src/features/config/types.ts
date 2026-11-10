export interface Weights { wE: number; wD: number; wQ: number }
export interface SystemSettings {
  allocation: Weights;
  dmaxRetailerKm: number;
  dmaxWarehouseKm: number;
  rotation: Weights & { velocityDays: number; minQty: number; roundTo: number };
  minRegionalStock: number;
  batchDiscountTiers: { maxRemainingPct: number; discountPct: number }[];
  loyaltyPointRateVnd: number;
}

/**
 * Shared transit table (F54). One table applies to every warehouse; each edit publishes a new
 * version instead of overwriting, so a run that already used an older version can be explained.
 * Distances are metres and durations minutes, matching the backend contract.
 */
export interface TransitBand {
  id?: string;
  minDistanceMeters: number;
  /** Exclusive: a band ends where the next one starts. */
  maxDistanceMeters: number;
  handlingMinutes: number;
  transitMinutes: number;
  estimatedCostAmount: number;
}

export interface TransitTable {
  id: string;
  version: number;
  maxServingDistanceMeters: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  note: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  bands: TransitBand[];
}

export interface PublishTransitTablePayload {
  maxServingDistanceMeters: number;
  effectiveFrom: string;
  note: string | null;
  bands: TransitBand[];
}

export interface ConfigDraft { settings: SystemSettings }

/** One point in the run day, already resolved to an instant for a business date by the server. */
export interface ScheduleMilestone {
  key: string;
  label: string;
  /** "HH:mm:ss" in the published time zone. */
  localTime: string;
  at: string;
  /** Dispatch slots are operational milestones, not allocation gates. */
  isAdvisory: boolean;
}

export interface RunSchedule {
  businessDate: string;
  timeZone: string;
  scheduleVersion: number;
  milestones: ScheduleMilestone[];
  preparationMinutes: number;
  bufferMinutes: number;
  dispatchSlotsLocalTime: string[];
}

/** Operational timing used after real-time allocation. */
export interface RunSchedulePayload {
  timeZone: string;
  preparationMinutes: number;
  bufferMinutes: number;
  dispatchSlotsLocalTime: string[];
}
