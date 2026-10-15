import { commercialData } from './commercial';
import { masterData } from './master';
import { orderData } from './orders';
import { stockData } from './stock';
import type { Db } from './types';

/** Fresh copy of the prototype seed (Portal.dc.html): orders DH-0010xx, warehouses WH-*, retailers 100041xx, LP-001, QUA-00x … */
export const buildSeed = (): Db => ({ ...masterData(), ...stockData(), ...orderData(), ...commercialData() });

/** The in-memory database – lives until the page is reloaded. */
export const db: Db = buildSeed();
export type { Db } from './types';
