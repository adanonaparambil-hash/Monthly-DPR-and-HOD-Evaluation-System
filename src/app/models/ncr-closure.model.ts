// ── NCR Request and Closure listing ─────────────────────────────────────────
//
// Deliberately shaped like ncr.model.ts / qtbt.model.ts / mir.model.ts: the screen is a
// copy of the MIR / WIR screen, so the contract behind it is a copy too.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface NcrClosureListRequest {
  docid?:        string | null;   // this request's own number
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  ncrNo?:        string | null;   // the NCR it closes
  subject?:      string | null;
  discipline?:   string | null;
  receiver?:     string | null;
  initiator?:    string | null;
  status?:       string | null;   // OPEN | CLOSED | NOT SET
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface NcrClosureRow {
  docid:           string;
  docdate:         string;   // DD/MM/YYYY
  ncrNo:           string;   // number of the NCR this closes
  projectCode:     string;
  projectName:     string;
  subject:         string;
  discipline:      string;
  request:         string;   // first part of the closure request text
  receiver:        string;   // empid - name
  receiverStatus:  string;   // APPROVED | PENDING
  initiator:       string;   // empid - name
  initiatorStatus: string;   // APPROVED | PENDING
  status:          string;   // OPEN | CLOSED | NOT SET
}
