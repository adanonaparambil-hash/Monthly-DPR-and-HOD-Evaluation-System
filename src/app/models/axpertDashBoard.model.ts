export interface LpoDashboardRequest {
  fromYear?: number;
  toYear?: number;
  fromMonth?: number | null;
  toMonth?: number | null;
  companies?: string[] | null;
  viewType: string;
}

export interface GrnDashboardRequest {
  fromYear: number;
  toYear: number;
  fromMonth?: number | null;
  toMonth?: number | null;
  companies?: string[] | null;
  viewType: string;
}

export interface ProjectDashboardRequest {
  companies?: string[] | null;
  projects?: string[] | null;
  year?: string | null;
}

export interface TopSupplierRequest {
  companies?: string[] | null;
  yearFrom?: number;
  yearTo?: number;
  topN: number;
}

export interface FacilitiesDashboardRequest {
  projects?: string[] | null;
  vendors?: string[] | null;
  year?: string | null;
  month?: string | null;
}

export interface SupplierTransactionRequest {
  company:    string;
  yearFrom?:  number;
  yearTo?:    number;
  offset:     number;
  batchSize:  number;
  isExport?:  boolean;
}