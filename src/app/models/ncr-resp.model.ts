// ── NCR Disposition and Acceptance listing ──────────────────────────────────
//
// Deliberately shaped like ncr.model.ts / qtbt.model.ts / mir.model.ts: the screen is a
// copy of the MIR / WIR screen, so the contract behind it is a copy too.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface NcrRespListRequest {
  docid?:        string | null;   // the response's own number
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  ncrNo?:        string | null;   // the NCR being answered
  subject?:      string | null;
  discipline?:   string | null;
  receiver?:     string | null;
  initiator?:    string | null;
  status?:       string | null;   // OPEN | CLOSED | NOT SET
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface NcrRespRow {
  docid:           string;
  docdate:         string;   // DD/MM/YYYY
  ncrNo:           string;   // number of the NCR this answers
  projectCode:     string;
  projectName:     string;
  subject:         string;
  discipline:      string;
  rootCause:       string;   // first part of the text
  receiver:        string;   // empid - name
  receiverStatus:  string;   // APPROVED | PENDING
  initiator:       string;   // empid - name
  initiatorStatus: string;   // APPROVED | PENDING
  status:          string;   // OPEN | CLOSED | NOT SET
}
