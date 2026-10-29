// ── QTBT (QA/QC Training Evidence Report) listing ────────────────────────────
//
// Deliberately shaped like mir.model.ts / wir.model.ts: the QTBT screen is a copy
// of the MIR / WIR screen, so the contract behind it is a copy too.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface QtbtListRequest {
  docid?:        string | null;
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  trainingType?: string | null;
  topic?:        string | null;
  location?:     string | null;
  preparedBy?:   string | null;
  qaqcBy?:       string | null;
  status?:       string | null;   // APPROVED | PENDING | REJECTED (the DGM's decision)
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface QtbtRow {
  docid:        string;
  docdate:      string;   // DD/MM/YYYY
  projectCode:  string;
  projectName:  string;
  trainingType: string;
  topics:       string;
  location:     string;
  staff:        string;
  operatives:   string;
  preparedBy:   string;
  qaqcBy:       string;   // DGM (QA/QC)
  status:       string;   // APPROVED | PENDING | REJECTED
}
