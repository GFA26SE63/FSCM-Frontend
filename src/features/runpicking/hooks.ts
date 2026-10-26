import { useQuery } from '@tanstack/react-query';
import { runPickingApi } from './api';

export const useRunByDate = (businessDate: string) =>
  useQuery({ queryKey: ['runpicking', 'run', businessDate], queryFn: () => runPickingApi.runByDate(businessDate) });

export const useRunPickingLists = (runId: string | undefined) =>
  useQuery({
    queryKey: ['runpicking', 'lists', runId],
    queryFn: () => runPickingApi.listsForRun(runId as string),
    enabled: !!runId,
  });

export const useWarehouseOptions = () =>
  useQuery({ queryKey: ['runpicking', 'warehouses'], queryFn: runPickingApi.warehouses });
