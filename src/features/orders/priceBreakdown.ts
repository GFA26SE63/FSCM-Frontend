import type { OrderDetail, OrderLine } from './types';

export const officialFragmentTotal = (line: OrderLine): number =>
  line.allocationFragments.reduce((sum, fragment) => sum + fragment.netAmount, 0);

export const officialOrderTotal = (order: OrderDetail): number =>
  order.lines.reduce((sum, line) => sum + officialFragmentTotal(line), 0);

export const hasReconciledOfficialTotal = (order: OrderDetail): boolean => {
  if (order.officialAmount == null) return order.lines.every((line) => line.allocationFragments.length === 0);
  return Math.abs(officialOrderTotal(order) - order.officialAmount) < 0.01;
};

export const discountRuleLabel = (line: OrderLine): string[] =>
  line.allocationFragments.map((fragment) => {
    if (fragment.discountRuleId == null) return `Không có bậc giảm · v${fragment.discountRuleVersion}`;
    return [fragment.discountRuleScope, fragment.discountRuleCode, `v${fragment.discountRuleVersion}`]
      .filter(Boolean)
      .join(' · ');
  });
