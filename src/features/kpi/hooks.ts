import { useQuery } from '@tanstack/react-query';
import { kpiApi } from './api';

export const useKpiSales = () => useQuery({ queryKey: ['kpi', 'sales'], queryFn: kpiApi.sales });
export const useProductRanking = () => useQuery({ queryKey: ['kpi', 'products'], queryFn: kpiApi.products });
