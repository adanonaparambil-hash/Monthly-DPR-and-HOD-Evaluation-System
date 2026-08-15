// ── WIR (Work Inspection Request) listing ─────────────────────────────────────

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface WirListRequest {
  docid?:       string | null;
  revno?:       string | null;
  fromDate?:    string | null;   // DD/MM/YYYY
  toDate?:      string | null;   // DD/MM/YYYY
  projectCode?: string | null;
  discipline?:  string | null;
  subject?:     string | null;
  location?:    string | null;
  zone?:        string | null;
  llevel?:      string | null;
  contractor?:  string | null;
  inspectedBy?: string | null;
  approvedBy?:  string | null;
  status?:      string | null;
  qaqcStatus?:  string | null;
  search?:      string | null;
  offset?:      number | null;   // rows to skip (server paging)
  limit?:       number | null;   // max rows to return (null = all)
}

export interface WirRow {
  docid:       string;
  revno:       string;
  docdate:     string;   // DD/MM/YYYY
  projectCode: string;
  projectName: string;
  discipline:  string;
  subject:     string;
  location:    string;
  zone:        string;
  llevel:      string;
  contractor:  string;
  inspectedBy: string;
  approvedBy:  string;
  status:      string;
  qaqcStatus:  string;
}
