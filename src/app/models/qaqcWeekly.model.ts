// ── Weekly QA/QC dashboard (POST api/QAQC/GetQaqcWeekly → PKG_QAQC.SP_GET_QAQC_WEEKLY) ──

export interface QaqcWeeklyRequest {
  fromDate?:     string | null;     // DD/MM/YYYY — blank = last Thursday → Thursday
  toDate?:       string | null;     // DD/MM/YYYY
  projectCodes?: string[] | null;   // PROJECTMASTER.PROJECTCODE as stored ('P. 409 AMD'); empty = every project
}

/** The week the server used. A date counts when  from < date <= to. */
export interface QaqcWeeklyPeriod {
  fromDate: string;   // DD/MM/YYYY
  toDate:   string;   // DD/MM/YYYY
}

export interface QaqcWeeklyProject {
  projectCode:  string;
  projectName:  string;
  projectLabel: string;          // 'P409 - AMD'

  obsTotal:          number;     // Observations / SI (site observation + audit reports)
  obsClosed:         number;
  obsClosedLastWeek: number;
  obsOpen:           number;

  ncrCumulative:     number;     // NCR
  ncrClosedLastWeek: number;
  ncrClosedTotal:    number;
  ncrOpen:           number;

  trainings:     number;         // QTBT
  trainingsWeek: number;
}

/** One block of the sheet — WIR / MIR for one department. Pending = no Code yet; it splits into
 *  commented (has an inspector comment) and openCount (none): code1+code2+code3+codeR+commented+openCount = total. */
export interface QaqcWeeklyIr {
  docType:    'WIR' | 'MIR' | string;
  department: string;
  code1:      number;
  code2:      number;
  code3:      number;
  codeR:      number;
  commented:  number;
  openCount:  number;
  total:      number;
}

/** The same WIR counts grouped by work discipline (STRUCTURAL, ARCHITECTURAL …). WIR only — MIR has no discipline. */
export interface QaqcWeeklyIrDiscipline {
  docType:    'WIR' | string;
  discipline: string;
  code1:      number;
  code2:      number;
  code3:      number;
  codeR:      number;
  commented:  number;
  openCount:  number;
  total:      number;
}

export interface QaqcWeeklyResult {
  period:       QaqcWeeklyPeriod;
  projects:     QaqcWeeklyProject[];
  ir:           QaqcWeeklyIr[];
  irDiscipline: QaqcWeeklyIrDiscipline[];
}

// ── Drill-down: the records behind one count (POST api/QAQC/GetQaqcDrill → SP_GET_QAQC_DRILL) ──

export type QaqcDrillKind = 'OBS' | 'NCR' | 'TRN' | 'WIR' | 'MIR';

export interface QaqcDrillRequest {
  kind:        QaqcDrillKind;
  /** OBS / NCR: TOTAL CLOSED OPEN WEEK · TRN: TOTAL WEEK · WIR / MIR: TOTAL CODE1 CODE2 CODE3 CODER COMMENTED OPEN */
  metric:      string;
  fromDate?:   string | null;       // DD/MM/YYYY — the week on screen (from < date <= to)
  toDate?:     string | null;
  projectCodes?: string[] | null;   // as stored ('P. 409 AMD'); empty = every project
  department?: string | null;       // WIR / MIR only
  discipline?: string | null;       // WIR only
}

/** One record behind a count. Same columns for every kind; the screen names them per kind. */
export interface QaqcDrillRow {
  docId:       string;   // also the key of the report PDF
  docDate:     string;   // DD/MM/YYYY
  projectCode: string;
  projectName: string;
  title:       string;
  category:    string;
  category2:   string;
  status:      string;   // empty for trainings
  person:      string;
  closedDate:  string;
}

export interface QaqcDrillResult {
  rows:       QaqcDrillRow[];
  totalCount: number;    // the real number of records (can exceed rows.length when the safety cap applied)
  capped:     boolean;
}
