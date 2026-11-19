import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/shared/hooks';
import { redeemApi } from './api';
import { fetchRedeemPage, lookupRetailerIds, lookupRetailerIdsBySalesGroup, lookupRewardIds, type RedeemPageQuery } from './redeemGraphql';
import { redemptionFeedback } from './policy';

/** Server-side cursor-paginated redemptions via GraphQL entities.rewardRedemptions. */
export const useRedemptionsPage = (q: RedeemPageQuery, enabled = true) =>
  useQuery({
    queryKey: ['redeem', 'page', q],
    queryFn: () => fetchRedeemPage(q),
    enabled,
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 15_000,
  });

/** Bounded id lookups that turn region / sales-group / search text into `in` lists. */
export function useRedeemScope(opts: { search?: string; regionId?: string; salesGroupId?: string }) {
  const { search, regionId, salesGroupId } = opts;
  const region = useQuery({ queryKey: ['redeem', 'lookup', 'region', regionId], queryFn: () => lookupRetailerIds({ regionId }), enabled: !!regionId, staleTime: 60_000, retry: false });
  const group = useQuery({ queryKey: ['redeem', 'lookup', 'group', salesGroupId], queryFn: () => lookupRetailerIdsBySalesGroup(salesGroupId!), enabled: !!salesGroupId, staleTime: 60_000, retry: false });
  const retailers = useQuery({ queryKey: ['redeem', 'lookup', 'retailers', search], queryFn: () => lookupRetailerIds({ search }), enabled: !!search, staleTime: 60_000, retry: false });
  const rewards = useQuery({ queryKey: ['redeem', 'lookup', 'rewards', search], queryFn: () => lookupRewardIds(search!), enabled: !!search, staleTime: 60_000, retry: false });
  const ready = (!regionId || region.isSuccess) && (!salesGroupId || group.isSuccess) && (!search || (retailers.isSuccess && rewards.isSuccess));
  const error = region.error ?? group.error ?? retailers.error ?? rewards.error;
  let scope: string[] | undefined;
  if (regionId && salesGroupId) scope = (region.data ?? []).filter((id) => (group.data ?? []).includes(id));
  else if (regionId) scope = region.data;
  else if (salesGroupId) scope = group.data;
  return { ready, error, scopeRetailerIds: scope, searchRetailerIds: retailers.data, searchRewardIds: rewards.data };
}

export const useRedemptions = () => useQuery({ queryKey: ['redeem', 'list'], queryFn: redeemApi.list });
export const useRedemption = (code: string) => useQuery({ queryKey: ['redeem', 'detail', code], queryFn: () => redeemApi.get(code) });
export const useRedeemStep = () => useApiMutation(redeemApi.step, { permission: 'redeem.manage', success: (_, v) => redemptionFeedback[v.step] });
