export interface Gift { code: string; name: string; points: number; stock: number; redeemed: number; status: 'Active' | 'Paused' }
export interface GiftInput { name: string; points: number; stock: number; status: Gift['status'] }
