export interface Gift { id: string; code: string; name: string; description?: string | null; imageUrl?: string | null; points: number; stock: number; redeemed: number; isActive?: boolean; status: 'Active' | 'Paused' }
export interface GiftInput { name: string; description?: string | null; imageUrl?: string | null; points: number; stock: number; status: Gift['status']; loyaltyProgramId: string }
