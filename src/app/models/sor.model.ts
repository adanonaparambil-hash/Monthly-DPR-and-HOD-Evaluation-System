// ── Site Observation / Audit Reports (SOR / QSAR) listing ───────────────────
//
// Deliberately shaped like ncr.model.ts / qtbt.model.ts / mir.model.ts: the screen is a
// copy of the MIR / WIR screen, so the contract behind it is a copy too.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface SorListRequest {
  docid?:        string | null;
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  reportType?:   string | null;   // SOR | QSAR
  contractType?: string | null;
  location?:     string | null;
  issuedBy?:     string | null;
  status?:       string | null;
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface SorRow {
  docid:          string;
  docdate:        string;   // DD/MM/YYYY
  projectCode:    string;
  projectName:    string;
  reportType:     string;   // SOR | QSAR
  contractType:   string;
  soLevel:        string;
  building:       string;
  location:       string;
  issuedBy:       string;   // empid - name
  approvedBy:     string;
  closedBy:       string;
  status:         string;
  observations:   number;   // how many observations the report carries
}
