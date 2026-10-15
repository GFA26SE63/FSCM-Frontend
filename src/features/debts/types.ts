export type ReceivableStatus = 'Unpaid' | 'Paid' | 'Overdue';
export interface Receivable {
  orderCode: string;
  retailerCode: string;
  retailerName: string;
  salesName: string;
  termDays: number;
  deliveredAt: string;
  dueDate: string;
  total: number;
  outstanding: number;
  status: ReceivableStatus;
  paidAt: string | null;
  collectedBy: string | null;
  method: 'Cash' | 'Transfer' | null;
}
export interface CollectResult { receivable: Receivable; pointsEarned: number }
