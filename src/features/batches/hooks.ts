import { useQuery } from '@tanstack/react-query';
import { batchApi } from './api';

export const useBatches = () => useQuery({ queryKey: ['batches', 'list'], queryFn: batchApi.list });
export const useBatch = (code: string) => useQuery({ queryKey: ['batches', 'detail', code], queryFn: () => batchApi.get(code) });
