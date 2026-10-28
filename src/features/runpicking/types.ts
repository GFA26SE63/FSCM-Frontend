/**
 * The warehouse picking sheet issued from an approved allocation run (F43).
 *
 * A sheet is organised the way the work happens: gather first, split second. One trip per batch
 * collects everything the run needs from it, and the split rows say which order each unit belongs
 * to. The split keeps the identifier of the price record the run settled on, so a line divided
 * across batches or warehouses still points at the money that was approved — picking never
 * recalculates a price.
 */
/**
 * As the server spells them. `Ready` is the end of picking, not the end of the order: the cartons
 * are on the dock, nothing has left and no stock has moved. `NeedsHandling` is a sheet someone
 * closed with an exception, which holds every order on it.
 */
export type RunPickingStatus = 'Issued' | 'Picking' | 'Ready' | 'NeedsHandling';

export interface RunPickingSplit {
  id: string;
  allocationRunAllocationId: string;
  /** The approved price record this part belongs to; picking carries it, never recomputes it. */
  allocationPlanPriceId: string;
  salesOrderId: string;
  orderCode: string;
  quantity: number;
  pickedQuantity: number;
}

export interface RunPickingGather {
  id: string;
  productId: string;
  sku: string;
  batchId: string;
  /** Never merged away: two batches of one SKU stay two rows, because the source matters. */
  batchCode: string;
  requiredQuantity: number;
  pickedQuantity: number;
  status: string;
  splits: RunPickingSplit[];
}

export interface RunPickingList {
  id: string;
  pickingCode: string;
  allocationRunId: string;
  allocationPlanVersionId: string;
  warehouseId: string;
  status: RunPickingStatus;
  issuedAt: string;
  version: number;
  gathers: RunPickingGather[];
  startedAt: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  exceptionType: string | null;
  exceptionNote: string | null;
}

export interface WarehouseOption { id: string; code: string; name: string }

export interface AllocationRunHeader {
  id: string;
  runCode: string;
  businessDate: string;
  cutoffAt: string;
  status: string;
}
