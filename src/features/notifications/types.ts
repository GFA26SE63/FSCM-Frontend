export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link: string | null;
}

/** Counters shown as orange badges in the sidebar menu (optional endpoint – menu works without it). */
export interface MenuBadges {
  orders: number;
  debts: number;
  retailers: number;
  redeem: number;
  complaints: number;
  disposal: number;
}
