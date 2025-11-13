export type StatsType = 'ALL' | 'QPRO' | 'CHED' | 'SUC' | 'AACUP' | 'HIGH_POSITION';

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
  untracked_count: number;
  self_employed_count?: number;
  awards_count?: number;
}

export interface CHEDStats extends BaseStats {
  type: 'CHED';
  pursuing_further_study: number;
  post_graduate_degree: number;
  further_study_rate: number;
  job_aligned_count?: number;
  self_employed_count?: number;
  awards_count?: number;
}

export interface SUCStats extends BaseStats {
  type: 'SUC';
  high_position_count: number;
  average_salary?: number;
  public_count: number;
  private_count: number;
  local_count: number;
  international_count: number;
  self_employed_count?: number;
  awards_count?: number;
}

export interface AACUPStats extends BaseStats {
  type: 'AACUP';
  employed_count: number;
  absorbed_count: number;
  high_position_count: number;
  employment_rate: number;
  absorption_rate: number;
  high_position_rate: number;
  self_employed_count: number;
  awards_count?: number;
}

export interface HighPositionStats extends BaseStats {
  type: 'HIGH_POSITION';
  high_position_count: number;
  high_position_rate: number;
  high_position_data: Array<{
    ctu_id: string;
    name: string;
    position: string | null;
    company: string | null;
    sector: string | null;
    course: string | null;
    year_graduated: number | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  }>;
  most_common_position?: string;
  most_common_company?: string;
  most_common_sector?: string;
  most_common_course?: string;
  average_salary?: number;
  awards_count?: number;
}

export type AnyStats = AllStats | QPROStats | CHEDStats | SUCStats | AACUPStats | HighPositionStats;
