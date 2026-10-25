export interface Complaint {
  id?: string;
  code: string; orderCode: string; retailerCode: string; retailerName: string; content: string; createdAt: string; status: 'Open' | 'Resolved'; result: string;
}
