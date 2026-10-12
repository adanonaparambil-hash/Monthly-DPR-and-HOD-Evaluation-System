/* ════════════════════════════════════════════════════════════════════════
   OT Request — shared model, Holiday Allowance Policy rules and SAMPLE data.
   Used by the submission page (ot-request) and the approval page
   (ot-approvals). UI ONLY: when the API exists, an OtService replaces
   buildSample() and the pages keep the same OtRequest shape.
   ════════════════════════════════════════════════════════════════════════ */

export interface OtTask { name: string; remark: string; mins: number; }

export type HodState = 'PENDING' | 'APPROVED' | 'REJECTED';
/** WAITING = not with Operations yet (HOD has not approved) */
export type OpsState = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type Allow = 'full' | 'half' | 'none';
export type Stage = 'hod' | 'ops' | 'done' | 'hod-rejected' | 'ops-rejected';

/** One eligible day of one employee: punches + DPR, with or without a request. */
export interface OtDay {
  empId: string;
  date: string;          // YYYY-MM-DD
  special: string;       // '' = Saturday
  punches: string[];     // 'HH:MM:SS', chronological
  site: string;
  tasks: OtTask[];
}

export interface OtRequest {
  id: number;
  empId: string;
  empName: string;
  dept: string;
  date: string;
  special: string;
  punches: string[];
  site: string;
  tasks: OtTask[];
  task: string;          // short task title the employee typed
  worked: number;        // minutes the employee logged
  brief: string;
  hodId: string;
  hodName: string;
  hod: HodState;
  hodRemark: string;
  ops: OpsState;
  opsRemark: string;
  requestedOn: string;   // ISO
}

export interface Hod { id: string; name: string; }

export const HODS: Hod[] = [
  { id: 'ITS41', name: 'Vinod Pillai' },
  { id: 'ADS3691', name: 'Sreekanth Sheela' },
  { id: 'ADS3960', name: 'Rahul Menon' },
  { id: 'ADS4129', name: 'Ahmed Al Balushi' },
  { id: 'IES82', name: 'Fatma Al Kindi' }
];

// ── policy ──────────────────────────────────────────────────────────────────

export const HALF_DAY_MIN = 4 * 60;

export const POLICY: { icon: string; title: string; points: string[] }[] = [
  { icon: 'fa-users', title: 'Eligibility', points: [
    'All Head Office staff who follow regular working hours, and all project engineers deployed across sites in Oman.'] },
  { icon: 'fa-file-lines', title: 'Documentation', points: [
    'Log overtime hours here (Staff OT Request).',
    'HODs verify and approve the entries.',
    'Proper punching and DPR entries are mandatory.',
    'HODs must also log their own OT hours to be eligible.'] },
  { icon: 'fa-wallet', title: 'Allowance details', points: [
    'Either an additional half-day or full-day salary.'] },
  { icon: 'fa-calendar-check', title: 'Payment', points: [
    'Paid with the salary of the following month.',
    'No allowance if the minimum requirements are not met.'] },
  { icon: 'fa-triangle-exclamation', title: 'Non-compliance', points: [
    'Discrepancies in OT logs may lead to corrective action.'] }
];

export const ALLOW_LABEL: Record<Allow, string> = { full: 'Full-day allowance', half: 'Half-day allowance', none: 'Not eligible by punches' };
export const STAGE_LABEL: Record<Stage, string> = {
  hod: 'Pending HOD', ops: 'With Operations', done: 'Confirmed', 'hod-rejected': 'HOD rejected', 'ops-rejected': 'Operations rejected'
};

// ── rules ───────────────────────────────────────────────────────────────────

export function toSec(t: string): number { const [h, m, s = 0] = t.split(':').map(Number); return h * 3600 + m * 60 + s; }

/** Time inside in/out pairs (in→out, break in→out …) — not first-to-last. */
export function workMin(punches: string[]): number {
  const p = punches.map(toSec);
  let s = 0;
  for (let i = 0; i + 1 < p.length; i += 2) { s += p[i + 1] - p[i]; }
  return Math.round(s / 60);
}

/** Policy 3: four valid punches (break out + in) = full day; ≥4 h with ≥2 punches = half day. */
export function allowance(punches: string[]): Allow {
  if (punches.length >= 4) { return 'full'; }
  return punches.length >= 2 && workMin(punches) >= HALF_DAY_MIN ? 'half' : 'none';
}

export function dprMin(tasks: OtTask[]): number { return tasks.reduce((s, t) => s + t.mins, 0); }

export function stage(r: OtRequest): Stage {
  if (r.hod === 'REJECTED') { return 'hod-rejected'; }
  if (r.hod === 'PENDING') { return 'hod'; }
  if (r.ops === 'REJECTED') { return 'ops-rejected'; }
  return r.ops === 'APPROVED' ? 'done' : 'ops';
}

export function stageCls(s: Stage): string {
  return s === 'done' ? 'ok' : s === 'hod-rejected' || s === 'ops-rejected' ? 'bad' : s === 'ops' ? 'info' : 'warn';
}

export interface Checks { ok: boolean; text: string; }
export function checks(punches: string[], tasks: OtTask[]): Checks[] {
  const n = punches.length, w = workMin(punches), d = dprMin(tasks);
  return [
    { ok: n >= 2, text: n >= 2 ? `${n} valid punches` : (n ? 'Only one punch' : 'No punches') },
    { ok: w >= HALF_DAY_MIN, text: `${hm(w)} worked between punches (4h needed)` },
    { ok: n >= 4, text: n >= 4 ? 'Break out and break in punched' : 'No break punches — needed for a full day' },
    { ok: d > 0, text: d > 0 ? `DPR logged — ${hm(d)}` : 'No DPR logged for the day' }
  ];
}

/** Punch bar between 06:00 and 20:00: worked pairs as segments, an unpaired punch as a dot. */
export interface Bar { segs: { l: number; w: number; t: string }[]; pts: { l: number; t: string }[]; }
export function bar(punches: string[]): Bar {
  const S = 6 * 3600, E = 20 * 3600;
  const pc = (v: number) => Math.max(0, Math.min(100, (v - S) / (E - S) * 100));
  const p = punches.map(toSec), out: Bar = { segs: [], pts: [] };
  for (let i = 0; i < p.length; i += 2) {
    if (p[i + 1] === undefined) { out.pts.push({ l: pc(p[i]), t: punches[i] }); }
    else { out.segs.push({ l: pc(p[i]), w: pc(p[i + 1]) - pc(p[i]), t: `${punches[i].slice(0, 5)} – ${punches[i + 1].slice(0, 5)}` }); }
  }
  return out;
}
export const BAR_TICKS = ['06:00', '09:00', '12:00', '15:00', '18:00', '20:00'];
export const BAR_GRID = [9, 12, 15, 18].map(h => (h - 6) / 14 * 100);

// ── formatting ──────────────────────────────────────────────────────────────

export function hm(min: number): string {
  const m = Math.max(Math.round(min), 0);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
export function hhmm(min: number): string {
  const m = Math.max(Math.round(min), 0);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
export function dateOf(iso: string): Date { const p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function isoOf(d: Date): string { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function fmtLong(iso: string): string { return dateOf(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
export function fmtShort(iso: string): string { return dateOf(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }); }
export function fmtStamp(iso: string): string {
  if (!iso) { return ''; }
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
export function initials(n: string): string { return (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
export function hue(id: string): number { let h = 0; for (const c of id) { h = (h * 31 + c.charCodeAt(0)) % 360; } return h; }
export function titleCase(s: string): string { return s.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase()); }

/** Old-page rule: an OT month stays open for requests until the 8th of the next month. */
export function monthOpen(y: number, m: number, today = new Date()): boolean {
  const cur = today.getFullYear() * 12 + today.getMonth(), k = y * 12 + m;
  return k === cur || (k === cur - 1 && today.getDate() < 9);
}

/** Saturdays up to today, plus one special working day (STAFF_OT_REQUEST_SPL_DATES). */
export function eligibleDates(y: number, m: number, today = new Date()): { iso: string; special: string }[] {
  const out: { iso: string; special: string }[] = [];
  const last = new Date(y, m + 1, 0).getDate();
  for (let i = 1; i <= last; i++) {
    const d = new Date(y, m, i);
    if (d > today) { break; }
    if (d.getDay() === 6) { out.push({ iso: isoOf(d), special: '' }); }
    else if (i === 7) { out.push({ iso: isoOf(d), special: 'Special working day — client inspection' }); }
  }
  return out;
}

export function csvDownload(name: string, head: string[], rows: (string | number)[][]): void {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = '﻿' + [head.map(q).join(','), ...rows.map(r => r.map(q).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

// ── SAMPLE data (fictitious) ────────────────────────────────────────────────

const PUNCHES: { p: string[]; site: string }[] = [
  { p: ['08:03:11', '12:53:06', '14:03:04', '18:07:10'], site: 'OFFICE-ADK' },
  { p: ['09:13:45', '13:22:31'], site: 'OFFICE-ADK' },
  { p: ['08:04:13', '12:56:37', '14:01:58', '18:27:46'], site: 'P-118 Sohar' },
  { p: ['07:58:35', '12:58:34'], site: 'OFFICE-ADK' },
  { p: ['08:04:35', '12:56:31', '14:05:27', '18:12:55'], site: 'P-221 Duqm' },
  { p: ['10:05:20', '13:20:02'], site: 'OFFICE-ADK' }          // under 4 h → not eligible
];
const TASKS: OtTask[][] = [
  [{ name: 'Exit form procedure changes', remark: 'Approval flow for Omani staff added and tested', mins: 230 },
   { name: 'Portal API fixes', remark: 'Resolved timeouts on the leave endpoints', mins: 190 }],
  [{ name: 'Website content update', remark: 'New property and director details published', mins: 225 }],
  [{ name: 'Visa renewal report', remark: 'DPR-based report for HR', mins: 260 },
   { name: 'Support tickets', remark: 'Closed 6 AdrakLive tickets', mins: 180 }],
  [{ name: 'Data checks', remark: 'Verified exit form records against HR master', mins: 280 }],
  [{ name: 'Release and testing', remark: 'AdrakLive updates tested and closed', mins: 470 }],
  []                                                             // DPR missing
];
const BRIEFS = [
  'Exit form procedure changes completed, the portal API issues were resolved and the website UI changes were finished.',
  'New property and director details added to the website; HSE section changes and exit form flow checks completed.',
  'Visa renewal report generated from DPR, website photos refreshed and the Omani approval workflow added to the exit form.',
  'Exit form module work and data checks to make sure the records are correct before month-end.',
  'AdrakLive updates completed, tested and closed with the users who reported them.'
];

let nextId = 1;
function req(p: Partial<OtRequest> & { date: string; empId: string; empName: string }): OtRequest {
  return { id: nextId++, dept: 'IT', special: '', punches: [], site: '', tasks: [], task: '', worked: 0, brief: '', hodId: HODS[0].id, hodName: HODS[0].name,
    hod: 'PENDING', hodRemark: '', ops: 'WAITING', opsRemark: '', requestedOn: '', ...p };
}

/** Sample for the signed-in employee: punch/DPR for every eligible day of the last two months, and requests on some. */
export function sampleMine(me: { id: string; name: string }): { days: OtDay[]; requests: OtRequest[] } {
  const now = new Date();
  const months = [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  const days: OtDay[] = [];
  const requests: OtRequest[] = [];
  // per month: which eligible-day index gets which request state
  const plan: ('ok' | 'ops' | 'pend' | 'rej' | '')[][] = [['ok', 'ops', 'ok', 'rej', '', ''], ['pend', '', 'rej', '', '']];
  months.forEach((ms, mi) => {
    eligibleDates(ms.getFullYear(), ms.getMonth(), now).forEach((x, i) => {
      const k = (mi * 2 + i) % PUNCHES.length;
      const noPunch = mi === 0 && i === 4;
      const day: OtDay = { empId: me.id, date: x.iso, special: x.special, punches: noPunch ? [] : PUNCHES[k].p, site: PUNCHES[k].site, tasks: noPunch ? [] : TASKS[k] };
      days.push(day);
      const st = plan[mi][i] ?? '';
      if (!st || allowance(day.punches) === 'none' || !dprMin(day.tasks)) { return; }
      const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
      requests.push(req({
        empId: me.id, empName: me.name, date: x.iso, special: x.special, punches: day.punches, site: day.site, tasks: day.tasks,
        task: day.tasks[0]?.name ?? '', worked: Math.round(workMin(day.punches) / 15) * 15, brief: BRIEFS[k % BRIEFS.length], requestedOn: ago(12 - i),
        hod: st === 'pend' ? 'PENDING' : st === 'rej' ? 'REJECTED' : 'APPROVED',
        hodRemark: st === 'rej' ? 'Please list what needed the weekend.' : st === 'pend' ? '' : 'Approved — urgent work.',
        ops: st === 'ok' ? 'APPROVED' : st === 'ops' ? 'PENDING' : 'WAITING',
        opsRemark: st === 'ok' ? 'Punches and DPR match.' : ''
      }));
    });
  });
  return { days, requests };
}

/** Sample for the approval screen: requests from the HOD's team, and from other HODs' teams for Operations. */
export function sampleQueue(me: { id: string; name: string }): OtRequest[] {
  const now = new Date();
  const people = [
    { id: 'ADN4266', name: 'Rahul Menon', dept: 'Projects', hod: me },
    { id: 'ADS5051', name: 'Fatma Al Kindi', dept: 'Finance', hod: me },
    { id: 'ITS20', name: 'Joseph Thomas', dept: 'IT', hod: me },
    { id: 'AIS557', name: 'Priya Nair', dept: 'Procurement', hod: me },
    { id: 'ADN4262', name: 'Mohammed Al Saadi', dept: 'Projects', hod: { id: HODS[1].id, name: HODS[1].name } },
    { id: 'IES83', name: 'Anitha George', dept: 'QA / QC', hod: { id: HODS[3].id, name: HODS[3].name } },
    { id: 'ADS4860', name: 'Salim Al Lawati', dept: 'Admin', hod: { id: HODS[4].id, name: HODS[4].name } }
  ];
  const states: [HodState, OpsState][] = [
    ['PENDING', 'WAITING'], ['PENDING', 'WAITING'], ['APPROVED', 'PENDING'], ['PENDING', 'WAITING'], ['APPROVED', 'PENDING'],
    ['APPROVED', 'APPROVED'], ['APPROVED', 'PENDING'], ['REJECTED', 'WAITING'], ['APPROVED', 'REJECTED'], ['PENDING', 'WAITING'], ['APPROVED', 'PENDING']
  ];
  const dates = [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)]
    .flatMap(ms => eligibleDates(ms.getFullYear(), ms.getMonth(), now));
  return states.map(([h, o], i) => {
    const p = people[i % people.length];
    const x = dates[dates.length - 1 - (i % Math.min(4, dates.length))];   // mostly this month
    const k = (i + 1) % PUNCHES.length;
    const w = workMin(PUNCHES[k].p);
    return req({
      empId: p.id, empName: p.name, dept: p.dept, date: x.iso, special: x.special, punches: PUNCHES[k].p, site: PUNCHES[k].site, tasks: TASKS[k],
      task: TASKS[k][0]?.name ?? 'Weekend support', worked: i === 1 ? w + 150 : Math.round(w / 15) * 15, brief: BRIEFS[i % BRIEFS.length],
      hodId: p.hod.id, hodName: p.hod.name, hod: h, ops: o, requestedOn: new Date(Date.now() - (i + 1) * 36e5 * 9).toISOString(),
      hodRemark: h === 'REJECTED' ? 'Not pre-approved.' : h === 'APPROVED' ? 'Approved.' : '',
      opsRemark: o === 'REJECTED' ? 'Duplicate of an earlier claim.' : o === 'APPROVED' ? 'OK.' : ''
    });
  });
}
