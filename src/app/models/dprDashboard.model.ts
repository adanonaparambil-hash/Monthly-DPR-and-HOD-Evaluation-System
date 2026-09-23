// ── DPR Dashboards (Employee + HOD) ───────────────────────────────────────────
// Shapes returned by PKG_DPR_DASH.SP_GET_EMP_DASHBOARD / SP_GET_HOD_DASHBOARD.
// C# PascalCase properties reach Angular as camelCase (System.Text.Json default).
// EVERY field is optional-or-nullable on purpose: Oracle can return NULL for any
// column, and on a proc error the cursors may be unopened/partially opened.
// 'Y'/'N' flags are plain strings — compare with === 'Y', never truthiness.

// ══ EMPLOYEE DASHBOARD ═══════════════════════════════════════════════════════

/** Cursor 1 — P_CUR_HERO (single row): identity, live today totals, running task, punches, quote. */
export interface DprEmpHero {
  empId?:              string | null;
  employeeName?:       string | null;
  department?:         string | null;   // untrimmed as stored
  designation?:        string | null;
  location?:           string | null;   // COM_LOC (e.g. IND / OMN)
  expectedDailyHours?: number | null;   // FN_DAILY_EXP for category+location (e.g. 8)
  isWorkingDayToday?:  string | null;   // 'Y' | 'N'
  onLeaveToday?:       string | null;   // 'Y' | 'N'
  todayLoggedMin?:     number | null;   // open timers counted live to user-local now
  tasksToday?:         number | null;   // distinct tasks touched today
  runningTaskId?:      number | null;   // null when no timer running
  runningTaskTitle?:   string | null;
  runningSince?:       string | null;   // 'HH24:MI'
  openBreakReason?:    string | null;   // LUNCH / QUICK / TRAVEL
  openBreakSince?:     string | null;   // 'HH24:MI'
  firstPunch?:         string | null;   // 'HH:MI' text
  lastPunch?:          string | null;   // 'HH:MI' text
  punchCount?:         number | null;
  punchTimes?:         string | null;   // LISTAGG ', ' separated, '...' on overflow
  breakMinToday?:      number | null;   // LUNCH + QUICK minutes
  travelMinToday?:     number | null;
  quoteText?:          string | null;
  quoteAuthor?:        string | null;
}

/** Cursor 2 — P_CUR_TILES (single row): month KPI tiles + pending-work counters. */
export interface DprEmpTiles {
  monthKey?:                string | null;   // 'YYYY-MM'
  monthHours?:              number | null;   // whole month, 1 dp, excludes DELETED tasks
  daysReported?:            number | null;
  workingDaysToDate?:       number | null;   // net, can be fractional
  workingDaysFullMonth?:    number | null;
  leaveDays?:               number | null;   // fractional allowed, PL excluded
  expectedHoursToDate?:     number | null;
  expectedHoursFullMonth?:  number | null;
  fulfilPct?:               number | null;   // UNCAPPED — can exceed 100
  consistencyPct?:          number | null;   // UNCAPPED
  openTasks?:               number | null;
  myLogsAwaitingApproval?:  number | null;
  formApprovalsWaitingMe?:  number | null;
}

/** Cursor 3 — P_CUR_TIMELINE (multi row): today's WORK + BREAK segments, chronological. */
export interface DprEmpTimelineSeg {
  segType?:   string | null;   // 'WORK' | 'BREAK'
  label?:     string | null;   // task title, or INITCAP(break reason)
  startTime?: string | null;   // 'HH24:MI'
  endTime?:   string | null;   // 'HH24:MI', null while still running/open
  minutes?:   number | null;   // open segments measured to now, floored at 0
  isRunning?: string | null;   // 'Y' | 'N'
}

/** Cursor 4 — P_CUR_WEEK (7 rows): last 7 days ending today, for the weekly bars. */
export interface DprEmpWeekDay {
  theDate?:      string | null;   // 'YYYY-MM-DD'
  dayName?:      string | null;   // MON, TUE, ...
  hours?:        number | null;   // 2 dp, 0 when nothing logged
  isWorkingDay?: string | null;   // 'Y' | 'N' — gross working day
  onLeave?:      string | null;   // 'Y' | 'N'
  isToday?:      string | null;   // 'Y' | 'N'
  targetHours?:  number | null;   // same value on every row
}

/** Cursor 5 — P_CUR_MONTH_CAL (multi row): one row per calendar day of the month. */
export interface DprEmpCalendarDay {
  theDate?:      string | null;   // 'YYYY-MM-DD'
  dayNum?:       number | null;   // 1..31
  dayName?:      string | null;
  hours?:        number | null;   // 2 dp
  isFuture?:     string | null;   // 'Y' | 'N'
  isToday?:      string | null;   // 'Y' | 'N'
  isWorkingDay?: string | null;   // 'Y' | 'N'
  onLeave?:      string | null;   // 'Y' | 'N'
  targetHours?:  number | null;   // constant across rows
}

/** Cursor 6 — P_CUR_MY_TASKS (max 30 rows): my open assignments, running first. */
export interface DprEmpTask {
  taskId?:         number | null;
  taskTitle?:      string | null;
  categoryName?:   string | null;   // null when uncategorised
  startDate?:      string | null;   // 'YYYY-MM-DD'
  targetDate?:     string | null;   // 'YYYY-MM-DD'
  progress?:       number | null;   // raw PROGRESS percent, may be null
  taskStatus?:     string | null;
  assigneeStatus?: string | null;   // OPEN / RUNNING / PAUSED (raw untrimmed)
  estimatedHours?: number | null;
  myLoggedHours?:  number | null;   // all-time, closed minutes only, 1 dp
  isRunning?:      string | null;   // 'Y' | 'N'
  isOverdue?:      string | null;   // 'Y' | 'N'
}

/** Cursor 7 — P_CUR_EST_ACT (max 10 rows): estimated vs actual for top tasks this month. */
export interface DprEmpEstAct {
  taskId?:           number | null;
  taskTitle?:        string | null;
  estimatedHours?:   number | null;
  monthHours?:       number | null;   // my hours on this task in the month, 1 dp
  totalActualHours?: number | null;   // my all-time hours, 1 dp
}

/** Cursor 8 — P_CUR_MY_FORMS (max 10 rows): my exit/leave requests + current step. */
export interface DprEmpForm {
  exitId?:         number | null;
  formType?:       string | null;   // 'Emergency Leave' | 'Planned Leave' | 'Resignation' | raw code
  status?:         string | null;   // raw APPROVAL_STATUS code (P/A/R ...)
  submittedDate?:  string | null;   // 'YYYY-MM-DD'
  departureDate?:  string | null;   // 'YYYY-MM-DD'
  duration?:       number | null;   // NO_OF_DAYS_APPROVED, may be null/fractional
  currentStep?:    string | null;   // lowest pending approver role, or 'Rejected'/'Completed'
}

/** Aggregate payload of SP_GET_EMP_DASHBOARD (mirrors the C# result wrapper). */
export interface DprEmployeeDashboard {
  hero:        DprEmpHero | null;
  tiles:       DprEmpTiles | null;
  timeline:    DprEmpTimelineSeg[];
  week:        DprEmpWeekDay[];
  calendar:    DprEmpCalendarDay[];
  myTasks:     DprEmpTask[];
  estVsActual: DprEmpEstAct[];
  myForms:     DprEmpForm[];
}

// ══ HOD DASHBOARD ════════════════════════════════════════════════════════════

/** Cursor 1 — P_CUR_DEPTS (multi row): dept pills. ALWAYS every managed dept, ignores P_DEPARTMENT. */
export interface DprHodDept {
  department?:  string | null;   // TRIMmed — send this back as the `department` filter
  teamCount?:   number | null;
  loggedToday?: number | null;
  runningNow?:  number | null;
}

/** Cursor 2 — P_CUR_SUMMARY (single row): hero KPI strip, scoped to the selected dept. */
export interface DprHodSummary {
  theDate?:              string | null;   // 'YYYY-MM-DD' user-local today
  monthKey?:             string | null;   // 'YYYY-MM'
  teamCount?:            number | null;
  loggedToday?:          number | null;
  runningNow?:           number | null;
  onLeaveToday?:         number | null;
  monthHours?:           number | null;   // whole selected month, 1 dp
  expectedHoursToDate?:  number | null;
  pendingLogApprovals?:  number | null;
  pendingFormApprovals?: number | null;   // NOT dept-scoped
}

/** Cursor 3 — P_CUR_TREND (14 rows): last 14 days ending today. */
export interface DprHodTrendDay {
  theDate?:        string | null;   // 'YYYY-MM-DD'
  dayName?:        string | null;
  totalHours?:     number | null;   // 1 dp, 0 when none
  membersLogged?:  number | null;
  membersPunched?: number | null;
  isToday?:        string | null;   // 'Y' | 'N'
}

/** Cursor 4 — P_CUR_FORM_QUEUE (max 15 rows): forms awaiting THIS HOD. Not dept-scoped. */
export interface DprHodFormQueueItem {
  exitId?:        number | null;
  approvalId?:    number | null;   // the TS_EMP_EXIT_APPROVAL row to act on
  employeeId?:    string | null;
  employeeName?:  string | null;
  department?:    string | null;   // raw, untrimmed
  formType?:      string | null;   // decoded label, else raw trimmed code
  requestDate?:   string | null;   // 'YYYY-MM-DD'
  departureDate?: string | null;   // 'YYYY-MM-DD'
  duration?:      number | null;   // may be null/fractional
  reason?:        string | null;   // planned-leave forms only
  approverRole?:  string | null;   // raw role code (HOD/HANDOVER/IT/...), NOT decoded
  approvalLevel?: number | null;
}

/** Cursor 5 — P_CUR_LOG_QUEUE (multi row): pending DPR/task log approvals per member. */
export interface DprHodLogQueueItem {
  employeeId?:       string | null;
  employeeName?:     string | null;
  designation?:      string | null;
  pendingLogCount?:  number | null;
  pendingMinutes?:   number | null;   // minutes awaiting approval
  lastActivityDate?: string | null;   // 'YYYY-MM-DD', null when all approval dates are null
}

/** Cursor 6 — P_CUR_TEAM (multi row): team pulse cards, one per scoped member.
 *  NOTE: the SQL LEFT JOINs profile documents unaggregated — a member with more than one
 *  PROFILE_PICTURE row can appear twice. De-duplicate by empId if the service does not. */
export interface DprHodTeamMember {
  empId?:               string | null;
  employeeName?:        string | null;
  designation?:         string | null;
  department?:          string | null;   // TRIMmed
  currentStatus?:       string | null;   // ACTIVE / LEAVE (raw, untrimmed)
  /**
   * NO LONGER SENT by /DprDash/Hod — the team cards render coloured initials (the
   * approved design has no photo), and fetching the BLOB cost one extra Oracle round
   * trip per member plus a base64 payload nothing drew. Kept on the interface so the
   * component's initials fallback still type-checks; it will always be undefined.
   */
  profileImageBase64?:  string | null;
  todayMin?:            number | null;   // open timers live
  runningNow?:          string | null;   // 'Y' | 'N'
  runningTaskTitle?:    string | null;   // null when idle
  lastPunch?:           string | null;   // 'HH:MI' text
  punchCount?:          number | null;
  monthHours?:          number | null;   // 1 dp, closed minutes only
  daysReported?:        number | null;
  expectedHoursToDate?: number | null;
  onLeaveToday?:        string | null;   // 'Y' | 'N'
}

/** Cursor 7 — P_CUR_ATTENDANCE (multi row): today's punch-vs-logged reconciliation, all members. */
export interface DprHodAttendanceRow {
  empId?:        string | null;
  employeeName?: string | null;
  designation?:  string | null;
  firstPunch?:   string | null;   // 'HH:MI' text
  lastPunch?:    string | null;   // 'HH:MI' text
  punchCount?:   number | null;
  punchTimes?:   string | null;   // ', ' separated, '...' on overflow
  loggedMin?:    number | null;
  breakMin?:     number | null;   // any reason, open breaks to now
  elapsedMin?:   number | null;   // measured punch span; undefined until the proc selects ELAPSED_MIN
  gapMin?:       number | null;   // punch span - logged - break, FLOORED AT 0 (not invertible); null when no punch
}

/** Cursor 8 — P_CUR_NOT_DONE (multi row): punched in today but no time log today. */
export interface DprHodNotDone {
  empId?:            string | null;
  employeeName?:     string | null;
  designation?:      string | null;
  firstPunch?:       string | null;   // 'HH:MI' text
  lastLogDate?:      string | null;   // 'YYYY-MM-DD', null if never logged
  daysSinceLastLog?: number | null;   // null if never logged
}

/** Cursor 9 — P_CUR_HEATMAP (multi row): member x last-10-days matrix, 10 rows per member. */
export interface DprHodHeatmapCell {
  empId?:        string | null;
  employeeName?: string | null;
  theDate?:      string | null;   // 'YYYY-MM-DD'
  dayName?:      string | null;
  hours?:        number | null;   // 1 dp, 0 when none
}

/** Cursor 10 — P_CUR_LEADERBOARD (multi row): month 80/10/10 composite ranking. */
export interface DprHodLeaderboardRow {
  empId?:          string | null;
  employeeName?:   string | null;
  monthHours?:     number | null;
  expectedHours?:  number | null;
  daysReported?:   number | null;
  fulfilPct?:      number | null;   // UNCAPPED
  consistencyPct?: number | null;   // UNCAPPED here (capped at 100 inside the composite only)
  remarkScore?:    number | null;   // 0-100 remark quality
  compositeScore?: number | null;   // 0.8*fulfil + 0.1*min(consistency,100) + 0.1*remark
  teamRank?:       number | null;   // 1 = best
}

/** Cursor 11 — P_CUR_EXCEPTIONS (multi row): computed exception rows.
 *  A member can appear in several rows (one per exception type). */
export interface DprHodException {
  excType?:      string | null;   // 'LOW_FULFIL' | 'STALE' | 'REMARK_DUP'
  empId?:        string | null;
  employeeName?: string | null;
  metricValue?:  number | null;   // fulfil % | days since last log (999 = never) | duplicate count
  detail?:       string | null;   // pre-built human sentence
}

/** Aggregate payload of SP_GET_HOD_DASHBOARD (mirrors the C# result wrapper). */
export interface DprHodDashboard {
  departments: DprHodDept[];
  summary:     DprHodSummary | null;
  trend:       DprHodTrendDay[];
  formQueue:   DprHodFormQueueItem[];
  logQueue:    DprHodLogQueueItem[];
  team:        DprHodTeamMember[];
  attendance:  DprHodAttendanceRow[];
  notDone:     DprHodNotDone[];
  heatmap:     DprHodHeatmapCell[];
  leaderboard: DprHodLeaderboardRow[];
  exceptions:  DprHodException[];
}
