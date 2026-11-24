export interface Gift {
  id: string; code: string; name: string; description?: string | null; imageUrl?: string | null;
  points: number; stock: number | null; redeemed: number | null; status: 'Active' | 'Paused';
  loyaltyProgramId: string; rewardType: string; discountAmount: number | null; discountPercent: number | null;
  imageReference?: string | null;
}
export interface GiftInput {
  name: string; description?: string | null; imageUrl?: string | null; points: number; stock: number | null;
  status: Gift['status']; loyaltyProgramId: string; rewardType?: string; discountAmount?: number | null; discountPercent?: number | null;
  imageFile?: File | null;
}
export interface GiftFilters { search?: string; status?: '' | 'Active' | 'Paused' | 'OutOfStock'; sort?: 'newest' | 'oldest' | 'pointsAsc' | 'pointsDesc'; after?: string; before?: string; pageSize?: number }
export interface GiftPage {
  items: Gift[]; totalCount: number;
  pageInfo: { startCursor: string | null; endCursor: string | null; hasNextPage: boolean; hasPreviousPage: boolean };
}
export interface GiftProgram { id: string; code: string; name: string; isActive: boolean }
export interface GiftSaveResult { gift: Gift; statusError?: string; imageError?: string }
