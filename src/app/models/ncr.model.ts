// ── NCR Issued (Non Conformance Report) listing ─────────────────────────────
//
// Deliberately shaped like mir.model.ts / qtbt.model.ts: the NCR screen is a copy
// of the MIR / WIR screen, so the contract behind it is a copy too.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface NcrListRequest {
  docid?:        string | null;
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  issuedFrom?:   string | null;
  issuedTo?:     string | null;
  subject?:      string | null;
  discipline?:   string | null;
  llevel?:       string | null;
  area?:         string | null;
  resident?:     string | null;
  receivedBy?:   string | null;
  status?:       string | null;   // OPEN | CLOSED | NOT SET
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface NcrRow {
  docid:          string;
  docdate:        string;   // DD/MM/YYYY
  projectCode:    string;
  projectName:    string;
  issuedFrom:     string;
  issuedTo:       string;
  copyTo:         string;
  subject:        string;
  discipline:     string;
  llevel:         string;
  area:           string;
  resident:       string;   // empid - name (Resident Engineer / initiated by)
  requiredRes:    string;   // required response time
  receiver:       string;   // empid - name
  residentStatus: string;   // APPROVED | PENDING
  receivedStatus: string;   // RECEIVED | PENDING
  status:         string;   // OPEN | CLOSED | NOT SET
}
