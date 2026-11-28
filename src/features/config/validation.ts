/** Compare the decimals actually serialized to JSON, avoiding binary floating point sums. */
export function validAllocationWeights(values: string[]): boolean {
  if (values.length !== 3 || values.some((v) => !v.trim() || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 1)) return false;
  const decimals = values.map((v) => {
    const [mantissa, exponent = '0'] = String(Number(v)).split('e');
    const fraction = (mantissa.split('.')[1] ?? '').length;
    return { digits: BigInt(mantissa.replace('.', '')), scale: fraction - Number(exponent) };
  });
  const scale = Math.max(0, ...decimals.map((v) => v.scale));
  return decimals.reduce((sum, v) => sum + v.digits * 10n ** BigInt(scale - v.scale), 0n) === 10n ** BigInt(scale);
}

export const validMinutes = (value: string): boolean =>
  value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647;

export const validKilometers = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 2147483.647 && Number(value.toFixed(3)) === value;

export const validMoney = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value < 1e16 && Number(value.toFixed(2)) === value;

export const dispatchSlots = (value: string): string[] => value.split(',').map(slot => slot.trim()).filter(Boolean);
export const validDispatchSlots = (value: string): boolean => {
  const slots = dispatchSlots(value);
  return slots.length > 0 && slots.every(slot => /^([01]\d|2[0-3]):[0-5]\d$/.test(slot))
    && new Set(slots).size === slots.length;
};
export const integerInRange = (value: string, min: number, max: number): boolean =>
  value.trim() !== '' && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
