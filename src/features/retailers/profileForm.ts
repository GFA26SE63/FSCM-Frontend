import type { UpdateRetailerProfilePayload } from './types';

const text = (value: unknown) => String(value ?? '').trim();
const number = (value: unknown) => Number(text(value).replace(',', '.'));

/** Compare and submit the same normalized, editable fields; exclude display-only fields. */
export function retailerProfilePayload(values: Record<string, unknown>): UpdateRetailerProfilePayload {
  return {
    name: text(values.name),
    contactName: text(values.contactName),
    phone: text(values.phone).replace(/\D/g, ''),
    email: text(values.email).toLowerCase() || undefined,
    address: text(values.address),
    retailerType: text(values.retailerType),
    forecastRevenue: number(values.forecastRevenue),
    storeSizeSquareMeters: number(values.storeSizeSquareMeters),
    purchasingCapacity: number(values.purchasingCapacity),
    purchaseFrequencyPerMonth: text(values.purchaseFrequencyPerMonth) === '' ? 4 : number(values.purchaseFrequencyPerMonth),
    requestedCreditTermDays: number(values.creditTermDays),
    assessmentNote: text(values.assessmentNote) || undefined,
    latitude: number(values.lat),
    longitude: number(values.lng),
  };
}

export function hasRetailerProfileChanges(initial: Record<string, unknown>, current: Record<string, unknown>): boolean {
  const before = retailerProfilePayload(initial);
  const after = retailerProfilePayload(current);
  return (Object.keys(before) as (keyof UpdateRetailerProfilePayload)[])
    .some(key => !Object.is(before[key], after[key]));
}
