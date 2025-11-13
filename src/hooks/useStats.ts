import { useQuery } from '@tanstack/react-query';
import {
  fetchAlumniStatistics,
  generateSpecificStats,
  exportDetailedAlumniData,
} from '../services/api';
import { AnyStats, StatsType } from '../types/stats';

export function useAvailableYears() {
  return useQuery({
    queryKey: ['stats', 'years'],
    queryFn: async () => {
      const res = await fetchAlumniStatistics();
      return res?.years ?? ([] as { year: number; count: number }[]);
    },
  });
}

export function useGenerateStats(year: string, course: string, type: StatsType) {
  return useQuery<AnyStats>({
    queryKey: ['stats', 'generate', { year, course, type }],
    queryFn: async () => generateSpecificStats(year, course, type),
    enabled: false,
  });
}

export function useDetailedAlumniData(year: string, course: string, type: StatsType) {
  return useQuery({
    queryKey: ['stats', 'detailed', { year, course, type }],
    queryFn: async () => {
      const res = await exportDetailedAlumniData(year, course, type);
      return res?.detailed_data ?? [];
    },
    enabled: false,
  });
}
