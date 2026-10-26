export type ReceivableStatus = 'Unpaid' | 'Paid' | 'Overdue';
export interface Receivable {
  id: string;
  orderId: string;
  orderCode: string;
  retailerId: string;
  retailerCode: string;
  retailerName: string;
  salesUserId: string;
  creditTermDays: number;
  deliveredDate: string | null;
  dueDate: string | null;
  amount: number;
  adjustedAmount: number;
  confirmedAmount: number;
  outstandingAmount: number;
  status: ReceivableStatus;
  paidDate: string | null;
  confirmedByUserId: string | null;
  collectionMethod: 'Cash' | 'BankTransfer' | null;
  version: number;
}
