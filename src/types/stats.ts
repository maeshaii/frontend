export type StatsType = 'ALL' | 'QPRO' | 'CHED' | 'SUC' | 'AACUP';

export interface BaseStats {
  type: StatsType;
  total_alumni: number;
  year?: string;
  course?: string;
}

export interface AllStats extends BaseStats {
  type: 'ALL';
  status_counts: Record<string, number>;
}

export interface QPROStats extends BaseStats {
  type: 'QPRO';
  employment_rate: number;
  employed_count: number;
  unemployed_count: number;
}

export interface CHEDStats extends BaseStats {
  type: 'CHED';
  pursuing_further_study: number;
  post_graduate_degree: number;
  further_study_rate: number;
  job_aligned_count?: number;
  self_employed_count?: number;
}

export interface SUCStats extends BaseStats {
  type: 'SUC';
  high_position_count: number;
  average_salary?: number;
}

export interface AACUPStats extends BaseStats {
  type: 'AACUP';
  employed_count: number;
  absorbed_count: number;
  high_position_count: number;
  employment_rate: number;
  absorption_rate: number;
  high_position_rate: number;
}

export type AnyStats = AllStats | QPROStats | CHEDStats | SUCStats | AACUPStats;
