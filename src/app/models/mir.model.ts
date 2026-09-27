// ── MIR (Material Inspection Request) listing ────────────────────────────────
//
// Deliberately shaped like wir.model.ts: the MIR screen is a copy of the WIR
// screen, so the contract behind it is a copy too. Where a field has no MIR
// equivalent it is left out rather than carried as a null.

// All filters optional — null/undefined means "not applied" (backend returns everything).
export interface MirListRequest {
  docid?:        string | null;
  revno?:        string | null;
  fromDate?:     string | null;   // DD/MM/YYYY
  toDate?:       string | null;   // DD/MM/YYYY
  projectCode?:  string | null;
  subject?:      string | null;
  material?:     string | null;
  supplier?:     string | null;
  manufacturer?: string | null;
  location?:     string | null;
  zone?:         string | null;
  llevel?:       string | null;
  contractor?:   string | null;
  inspectedBy?:  string | null;
  receivedBy?:   string | null;
  status?:       string | null;
  qaqcStatus?:   string | null;
  search?:       string | null;
  offset?:       number | null;   // rows to skip (server paging)
  limit?:        number | null;   // max rows to return (null = all)
}

export interface MirRow {
  docid:        string;
  revno:        string;
  docdate:      string;   // DD/MM/YYYY
  projectCode:  string;
  projectName:  string;
  subject:      string;
  materialDesc: string;
  manufacturer: string;
  supplier:     string;
  marRefNo:     string;
  location:     string;
  zone:         string;
  llevel:       string;
  contractor:   string;
  inspectedBy:  string;
  receivedBy:   string;
  againstNcr:   string;
  status:       string;
  qaqcStatus:   string;
}
