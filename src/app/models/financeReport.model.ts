/**
 * Supplier payment reports (Finance menu).
 * Served by PKG_FINANCE_REPORTS, which reads the ADK2026 (Axpert) schema.
 */

/** One branch for the filter dropdown — id and name arrive together. */
export interface BranchOption {
  branchId?: number;
  branchName?: string;
}

/**
 * Filters shared by both reports.
 *
 * branchId is a NUMBER. The report compares it against a number, and passing
 * text is what produced ORA-01722 when the query was run by hand. `1` is the
 * "all branches" sentinel and must go together with branchName = 'ALL'.
 *
 * projectCode / vendorName / outstandingStatus are fixed for now — there is no
 * picker for them on screen yet — but they are real fields rather than server
 * constants so adding those filters later is a UI change only.
 */
export interface SupplierReportRequest {
  branchName: string;
  branchId: number;
  projectCode: string;
  vendorName: string;
  outstandingStatus: string;
  /** 'ALL', or one currency name. Applied in the procedure, not the browser. */
  currency: string;
  /** Column name the procedure recognises, e.g. 'TOTAL_OUTSTANDING'. */
  sortColumn: string;
  /** 'ASC' or 'DESC'. */
  sortDir: string;
  /** 1-based batch number. */
  pageNo: number;
  /** Rows per batch. 0 means "every row" and is used only by Export. */
  pageSize: number;
}

/** Report 1 — what falls due, in 30-day buckets from today. */
export interface SupplierPaymentForecastRow {
  // branchName / bid / projectCode / outstand are gone - the procedure no
  // longer echoes back the constants the caller sent, and nothing showed them.
  vendorName?: string;
  currency?: string;
  overdue?: number;
  next_30_Days?: number;
  days_31_60?: number;
  days_61_90?: number;
  days_91_120?: number;
  above_120_Days?: number;
  total_Outstanding?: number;
}

/** Report 2 — how far PAST due the outstanding amounts already are. */
export interface SupplierOverdueAgingRow {
  // branchName / bid / projectCode / outstand are gone - the procedure no
  // longer echoes back the constants the caller sent, and nothing showed them.
  vendorName?: string;
  currency?: string;
  days_1_30?: number;
  days_31_60?: number;
  days_61_90?: number;
  days_91_120?: number;
  days_121_180?: number;
  above_180_Days?: number;
  total_Overdue?: number;
  total_Outstanding?: number;
}

/** One currency for the Currency column's filter. */
export interface CurrencyOption {
  currency?: string;
}

/** A column heading that can be sorted, and optionally filtered. */
export interface ReportColumn {
  /** Name the PROCEDURE knows it by - this is what goes to the server. */
  key: string;
  label: string;
  /** Left-aligned text column vs right-aligned money column. */
  text?: boolean;
  /** Show the funnel (only Currency has one today). */
  filter?: boolean;
}
