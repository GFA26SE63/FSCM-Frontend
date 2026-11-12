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
