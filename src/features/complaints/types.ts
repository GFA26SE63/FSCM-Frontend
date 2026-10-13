export interface Complaint {
  code: string; orderCode: string; retailerCode: string; retailerName: string; content: string; createdAt: string; status: 'Open' | 'Resolved'; result: string;
}
