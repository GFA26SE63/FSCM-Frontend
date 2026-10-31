import { useQueries } from '@tanstack/react-query';
import { shipmentsApi } from './api';
import type { OrderShipmentReadiness } from './types';

/**
 * Readiness of several orders at once.
 *
 * One query per order rather than one combined call: readiness changes when any warehouse picks or
 * a payment clears, so each order has its own cache entry and a slow one does not blank the rest
 * of the screen.
 */
export const useOrdersReadiness = (orderIds: string[]) =>
  useQueries({
    queries: orderIds.map((orderId) => ({
      queryKey: ['shipments', 'readiness', orderId],
      queryFn: () => shipmentsApi.readiness(orderId),
    })),
    combine: (results) => ({
      loading: results.some((result) => result.isPending),
      /** First failure, if any: a missing readiness is worth saying out loud, not hiding. */
      error: results.find((result) => result.isError)?.error ?? null,
      data: results
        .map((result) => result.data)
        .filter((item): item is OrderShipmentReadiness => !!item),
    }),
  });
