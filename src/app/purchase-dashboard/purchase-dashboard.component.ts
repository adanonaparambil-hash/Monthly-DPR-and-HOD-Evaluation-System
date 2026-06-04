import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Api } from '../services/api';
import {
  LpoDashboardRequest, GrnDashboardRequest,
  ProjectDashboardRequest, TopSupplierRequest, FacilitiesDashboardRequest
} from '../models/axpertDashBoard.model';

gsap.registerPlugin(ScrollTrigger);
Chart.register(...registerables);

// ── Unified OMR → Millions converter ────────────────────────────────────────
// API always returns raw OMR values; divide by 1,000,000 to get millions.
function toMillions(v: number): number {
  if (!isFinite(v) || isNaN(v)) return 0;
  return +(v / 1_000_000).toFixed(4);
}
const threedBarPlugin = {
  id: 'threedBar',
  afterDatasetDraw(chart: any) {
    const { ctx } = chart;
    const DX = 11, DY = 5;
    chart.data.datasets.forEach((_: any, di: number) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'bar') return;
      meta.data.forEach((bar: any) => {
        try {
          const { x, y, base, width } = bar.getProps(['x', 'y', 'base', 'width'], false);
          if (Math.abs(base - y) < 3) return;
          const hw = width / 2;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x - hw, y); ctx.lineTo(x - hw + DX, y - DY);
          ctx.lineTo(x + hw + DX, y - DY); ctx.lineTo(x + hw, y);
          ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + hw, y); ctx.lineTo(x + hw + DX, y - DY);
          ctx.lineTo(x + hw + DX, base - DY); ctx.lineTo(x + hw, base);
          ctx.closePath(); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fill();
          ctx.restore();
        } catch { /* skip */ }
      });
    });
  }
};

// ── Doughnut center label plugin ────────────────────────────────────────────
const centerLabelPlugin = {
  id: 'centerLabel',
  afterDraw(chart: any) {
    if (chart.config.type !== 'doughnut') return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top  + chartArea.bottom) / 2;
    const rawData: number[] = chart.data.datasets[0]?.data ?? [];
    const total = rawData.reduce((a: number, b: number) => a + b, 0);
    const isNoData = total === 0;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (isNoData) {
      ctx.font = 'bold 15px Roboto,sans-serif'; ctx.fillStyle = '#94a3b8';
      ctx.fillText('No Data', cx, cy - 8);
      ctx.font = '11px Roboto,sans-serif'; ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Available', cx, cy + 12);
    } else {
      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, 44, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245,158,11,0.07)';
      ctx.fill();
      // Total value
      ctx.font = 'bold 22px Roboto,sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(total.toFixed(2) + ' M', cx, cy - 12);
      // Label
      ctx.font = '600 11px Roboto,sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('Total OMR', cx, cy + 12);
    }
    ctx.restore();
  }
};

// ── Modern vivid palette (light-friendly) ───────────────────────────────────
const P_INDIGO  = '#6366f1';
const P_SKY     = '#0ea5e9';
const P_VIOLET  = '#8b5cf6';
const P_ROSE    = '#f43f5e'; const P_TEAL      = '#14b8a6';
const P_ORANGE  = '#f97316'; const P_CYAN      = '#06b6d4';

// Rich multi-colour palette for LPO bars — each bar gets its own vivid colour
const LPO_BAR_COLORS = [
  '#6366f1','#10b981','#f59e0b','#0ea5e9',
  '#8b5cf6','#f43f5e','#14b8a6','#f97316',
  '#06b6d4','#84cc16','#ec4899','#3b82f6'
];

// Vivid doughnut palette — rich, well-separated hues
const DONUT_VIVID = [
  '#6366f1','#10b981','#f59e0b','#f43f5e','#0ea5e9',
  '#8b5cf6','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899','#3b82f6'
];

// ── Fallback mock data (used when API has no data) ───────────────────────────
const MONTHS_ALL = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LPO_ALL_VALUES = [2.59,2.33,2.93,2.04,2.45,2.61,2.78,2.90,2.55,2.38,2.20,2.10];

const GRN_YEARLY = {
  years:  ['2017','2018','2019','2020','2021','2022','2023','2024','2025','2026'],
  values: [39.2,37.7,31.5,20.1,19.7,22.1,25.1,17.2,22.9,6.9]
};

const MAIN_PROJECTS = {
  shortLabels:['Mech.Wkshp','P.329 WPCA','P.275 STF','P.314 SRHQ','CWS',
               'P.255 OSTF','P.288 LSTF','P.285 OTF','P.279 NAK','P.392 CLA','P.249 SU','NRW'],
  poValues:  [32.5,21.4,14.2,12.8,11.3,10.5,9.2,7.8,6.4,5.8,5.1,4.7],
  grnValues: [30.1,19.8,12.5,11.4,10.2,9.1,8.3,6.9,5.7,5.1,4.4,4.0]
};

const TOP_SUPPLIERS = {
  labels: ['MIS. AL ADRA K TRADING','RAD. DIVISION','ANA ENTERPRISE G',
           'MS. NEW ROTING CO SAO','MIS. NUHAS O MAN LLC','ENTERPRISE L',
           'MS. KHIMJI RAMPAS LLC','MS. EAST & WEST TRADING','MIS. TARMAC ZAWAWI',
           'MIS. RAHMAN ENG CO','MR. THOMAS A ALEXANDER','MS. OMAN PO EN PRODUCTS'],
  values: [56.2,36.4,22.4,22.2,18.9,11.7,10.2,9.4,8.1,7.7,7.6,6.0]
};

const MAIN_FACILITIES = [
  {name:'Mech. Workshop',po:32.5,grn:30.1},{name:'P.329 WPCA',po:21.4,grn:19.8},
  {name:'P.275 STF',po:14.2,grn:12.5},{name:'P.314 SRHQ',po:12.8,grn:11.4},
  {name:'CWS',po:11.3,grn:10.2},{name:'P.255 OSTF',po:10.5,grn:9.1},
  {name:'P.288 LSTF',po:9.2,grn:8.3},{name:'P.285 OTF',po:7.8,grn:6.9},
  {name:'P.279 NAK',po:6.4,grn:5.7},{name:'P.392 CLA',po:5.8,grn:5.1},
];

// ── Chart info metadata ──────────────────────────────────────────────────────
const CHART_META: Record<string,{title:string,icon:string,type:string,clr:string}> = {
  lpo:       {title:'Monthly LPO',                      icon:'fas fa-shopping-cart', type:'3D Bar + Trend',    clr:'emerald'},
  grn:       {title:'GRN Value (Yearly)',               icon:'fas fa-receipt',        type:'Area Chart',        clr:'indigo'},
  projects:  {title:'Main Projects — PO vs GRN',        icon:'fas fa-project-diagram',type:'Grouped H. Bar',   clr:'teal'},
  suppliers: {title:'Top Suppliers',                    icon:'fas fa-industry',       type:'Doughnut',          clr:'amber'},
  facilities:{title:'Main Facilities — PO vs GRN',      icon:'fas fa-building',       type:'Grouped H. Bar',   clr:'teal'},
};

@Component({
  selector: 'app-purchase-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-dashboard.component.html',
  styleUrls: ['./purchase-dashboard.component.css']
})
export class PurchaseDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  constructor(private api: Api) {}

  // Grid canvases
  @ViewChild('lpoCanvas')        lpoRef!:        ElementRef<HTMLCanvasElement>;
  @ViewChild('grnCanvas')        grnRef!:        ElementRef<HTMLCanvasElement>;
  @ViewChild('projectsCanvas')   projectsRef!:   ElementRef<HTMLCanvasElement>;
  @ViewChild('suppliersCanvas')  suppliersRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('facilitiesCanvas') facilitiesRef!: ElementRef<HTMLCanvasElement>;
  // Modal canvas
  @ViewChild('modalCanvas')      modalRef!:      ElementRef<HTMLCanvasElement>;

  private charts = new Map<string, Chart>();

  // ── Expand state ────────────────────────────────────────────────────────────
  expandedChart: string | null = null;
  get expandedMeta() { return this.expandedChart ? CHART_META[this.expandedChart] : null; }

  // ── Dropdown open flags ─────────────────────────────────────────────────────
  lpoCoOpen=false; grnCoOpen=false; projCoOpen=false; projPrOpen=false;
  suppCoOpen=false; facilCoOpen=false; facilPrOpen=false;

  // ── Dropdown search terms ────────────────────────────────────────────────────
  lpoCoSearch=''; grnCoSearch=''; projCoSearch=''; projPrSearch=''; suppCoSearch='';

  /** Close all dropdowns when clicking outside any dropdown wrapper */
  @HostListener('document:click')
  closeAllDropdowns() {
    this.lpoCoOpen = this.grnCoOpen = this.projCoOpen = this.projPrOpen =
    this.suppCoOpen = this.facilCoOpen = this.facilPrOpen = false;
  }

  /** Filter a string list by a search term (case-insensitive) */
  filterList(list: string[], term: string): string[] {
    if (!term.trim()) return list;
    const t = term.toLowerCase();
    return list.filter(item => item.toLowerCase().includes(t));
  }

  // ── Combined Projects & Facilities tab ──────────────────────────────────────
  pfTab: 'projects' | 'facilities' = 'projects';

  switchPFTab(tab: 'projects' | 'facilities') {
    this.pfTab = tab;
    // Rebuild the chart for the newly visible tab after Angular re-renders the canvas
    setTimeout(() => this.build(tab), 50);
  }

  // ── Dropdown options from API ────────────────────────────────────────────────
  companies:  string[] = [];
  projects:   string[] = [];
  facilities: string[] = [];

  private companyNameToCode = new Map<string, string>();
  private projectNameToCode = new Map<string, string>();

  // ── Multi-select filter arrays (empty = all) ─────────────────────────────────
  lpoCompanies:   string[] = [];
  grnCompanies:   string[] = [];
  projCompanies:  string[] = [];
  projProjects:   string[] = [];
  suppCompanies:  string[] = [];
  facilCompanies: string[] = [];
  facilProjects:  string[] = [];

  // ── Other LPO/GRN/Supp scalar filters ───────────────────────────────────────
  // Current date constants — used to cap the month slider
  readonly TODAY        = new Date();
  readonly CURRENT_YEAR = this.TODAY.getFullYear();
  readonly CURRENT_MONTH_IDX = this.TODAY.getMonth(); // 0-based (Jan=0 … Dec=11)

  lpoYear      = this.CURRENT_YEAR;
  lpoMonthFrom = 0;
  lpoMonthTo   = this.CURRENT_MONTH_IDX; // default: Jan → current month
  lpoView: 'monthly' | 'yearly' = 'monthly';
  lpoYearFrom=0; lpoYearTo=this.CURRENT_YEAR - 2017; // yearly-mode year range (index into lpoYears)
  grnYearFrom=0; grnYearTo=9; grnMonthFrom=0; grnMonthTo=this.CURRENT_MONTH_IDX; grnView:'yearly'|'monthly'='yearly';
  // GRN monthly-mode: single year dropdown (mirrors lpoYear logic)
  grnYear = this.CURRENT_YEAR;
  suppYearFrom=0; suppYearTo=9; suppCount=10;

  readonly lpoYears    = Array.from({ length: this.CURRENT_YEAR - 2017 + 1 }, (_, i) => 2017 + i);
  readonly monthLabels = MONTHS_ALL;
  readonly grnYears    = GRN_YEARLY.years;
  // GRN year dropdown options — same range as grnYears array values
  readonly grnYearOptions = GRN_YEARLY.years.map(y => +y);

  /** Max index the "To Month" slider can reach for the LPO chart.
   *  Current year → capped at today's month; any past year → full 12 months (index 11). */
  get lpoMaxMonth(): number {
    return this.lpoYear === this.CURRENT_YEAR ? this.CURRENT_MONTH_IDX : 11;
  }

  /** Max month index for the GRN monthly slider — mirrors LPO logic. */
  get grnMaxMonth(): number {
    return this.grnYear === this.CURRENT_YEAR ? this.CURRENT_MONTH_IDX : 11;
  }

  /** Clear company filter for the combined PF card */
  clearPFCompany() {
    if (this.pfTab === 'projects') { this.projCompanies = []; this.loadProjects(); this.onProj(); }
    else                           { this.facilCompanies = []; this.loadProjects(); this.onFacil(); }
  }

  /** Clear company filter from modal (uses expandedChart) */
  clearPFCompanyModal() {
    if (this.expandedChart === 'projects') { this.projCompanies = []; this.loadProjects(); this.onProj(); }
    else                                   { this.facilCompanies = []; this.loadProjects(); this.onFacil(); }
  }

  /** Called when LPO view radio (Monthly/Yearly) changes — resets sliders to sensible defaults. */
  onLpoViewChange() {
    if (this.lpoView === 'monthly') {
      this.lpoYear = this.CURRENT_YEAR;
      this.lpoMonthFrom = 0;
      this.lpoMonthTo   = this.CURRENT_MONTH_IDX;
    } else {
      this.lpoYearFrom = 0;
      this.lpoYearTo   = this.lpoYears.length - 1;
    }
    this.onLPO();
  }

  /** Called when GRN view radio (Yearly/Monthly) changes — resets sliders to sensible defaults. */
  onGrnViewChange() {
    if (this.grnView === 'yearly') {
      this.grnYearFrom = 0;
      this.grnYearTo   = 9;
    } else {
      this.grnYear      = this.CURRENT_YEAR;
      this.grnMonthFrom = 0;
      this.grnMonthTo   = this.CURRENT_MONTH_IDX;
    }
    this.onGRN();
  }

  /** Called whenever the year dropdown changes — resets month range to full year for past years,
   *  or clamps to current month for the current year. */
  onLpoYearChange() {
    if (this.lpoYear === this.CURRENT_YEAR) {
      // Current year: show Jan → current month
      this.lpoMonthFrom = 0;
      this.lpoMonthTo   = this.CURRENT_MONTH_IDX;
    } else {
      // Past year: show full year Jan → Dec
      this.lpoMonthFrom = 0;
      this.lpoMonthTo   = 11;
    }
    this.onLPO();
  }

  /** Called whenever the GRN year dropdown changes in monthly mode. */
  onGrnYearChange() {
    if (this.grnYear === this.CURRENT_YEAR) {
      this.grnMonthFrom = 0;
      this.grnMonthTo   = this.CURRENT_MONTH_IDX;
    } else {
      this.grnMonthFrom = 0;
      this.grnMonthTo   = 11;
    }
    this.onGRN();
  }

  // ── Chart data from API ──────────────────────────────────────────────────────
  private lpoChartLabels: string[] = [];
  private lpoChartValues: number[] = [];
  private grnChartLabels: string[] = [];
  private grnChartValues: number[] = [];
  private projChartData:  any[] | null = null;
  private suppChartData:  any[] | null = null;
  private facilChartData: any[] | null = null;

  // ── Computed display values ──────────────────────────────────────────────────
  get lpoTotal() {
    // lpoChartValues are already in millions (M); sum them directly
    const v = this.lpoChartValues.length
      ? this.lpoChartValues
      : LPO_ALL_VALUES.slice(Math.min(this.lpoMonthFrom,this.lpoMonthTo), Math.max(this.lpoMonthFrom,this.lpoMonthTo)+1);
    return Math.round(v.reduce((a,b)=>a+b,0)*1000)/1000;
  }
  get grnTotal() {
    // grnChartValues are already in millions after conversion
    const v = this.grnChartValues.length
      ? this.grnChartValues
      : GRN_YEARLY.values.slice(this.grnYearFrom, this.grnYearTo+1);
    return Math.round(v.reduce((a,b)=>a+b,0)*1000)/1000;
  }
  get lpoFromLbl()     { return MONTHS_ALL[Math.min(this.lpoMonthFrom,this.lpoMonthTo)]; }
  get lpoToLbl()       { return MONTHS_ALL[Math.max(this.lpoMonthFrom,this.lpoMonthTo)]; }
  get lpoFromYearLbl() { return this.lpoYears[Math.min(this.lpoYearFrom,this.lpoYearTo)]; }
  get lpoToYearLbl()   { return this.lpoYears[Math.max(this.lpoYearFrom,this.lpoYearTo)]; }
  get grnFromYear() { return GRN_YEARLY.years[Math.min(this.grnYearFrom,this.grnYearTo)]; }
  get grnToYear()   { return GRN_YEARLY.years[Math.max(this.grnYearFrom,this.grnYearTo)]; }
  get grnFromMonth(){ return MONTHS_ALL[Math.min(this.grnMonthFrom,this.grnMonthTo)]; }
  get grnToMonth()  { return MONTHS_ALL[Math.max(this.grnMonthFrom,this.grnMonthTo)]; }
  get suppFromYear(){ return 2017+this.suppYearFrom; }
  get suppToYear()  { return 2017+this.suppYearTo; }

  // formatM: input is already in millions (M units)
  formatM(val: number): string {
    if (val >= 1000) return (val / 1000).toFixed(2) + ' B';  // billions edge case
    return val.toFixed(3) + ' M';
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────────
  isSelected(arr: string[], val: string): boolean { return arr.includes(val); }

  getLabel(arr: string[], placeholder: string): string {
    if (!arr.length) return placeholder;
    if (arr.length === 1) return arr[0].length > 28 ? arr[0].slice(0, 27) + '…' : arr[0];
    return `${arr.length} selected`;
  }

  toggleMulti(arr: string[], val: string): string[] {
    const idx = arr.indexOf(val);
    return idx > -1 ? arr.filter((_,i) => i !== idx) : [...arr, val];
  }

  private getCodes(names: string[]): string[] | null {
    if (!names.length) return null;
    return names.map(n => this.companyNameToCode.get(n) ?? n);
  }

  private getProjCodes(names: string[]): string[] | null {
    if (!names.length) return null;
    return names.map(n => this.projectNameToCode.get(n) ?? n);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadCompanies();
    this.loadProjects();
  }

  ngAfterViewInit() { setTimeout(()=>{ this.loadAllCharts(); this.runGSAP(); },150); }

  // ── Dropdown loaders ─────────────────────────────────────────────────────────
  private loadCompanies() {
    this.api.GetCompanyDropdown().subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.companyNameToCode.clear();
        data.forEach((d: any) => {
          // Support multiple possible field name shapes from the API
          const name = d.name ?? d.companyName ?? d.description ?? d.label ?? '';
          const code = d.code ?? d.companyCode ?? d.id ?? d.value ?? name;
          if (name) this.companyNameToCode.set(name, code);
        });
        const names = data
          .map((d: any) => d.name ?? d.companyName ?? d.description ?? d.label ?? '')
          .filter(Boolean);
        this.companies = ['All Companies', ...names];
      },
      error: () => { /* keep defaults */ }
    });
  }

  loadProjects(companyCodes: string[] | null = null) {
    this.api.GetProjectDropdown(companyCodes).subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.projectNameToCode.clear();
        data.forEach((d: any) => {
          // Support multiple possible field name shapes from the API
          const name = d.name ?? d.projectName ?? d.description ?? d.label ?? '';
          const code = d.code ?? d.projectCode ?? d.id ?? d.value ?? name;
          if (name) this.projectNameToCode.set(name, code);
        });
        const names = data
          .map((d: any) => d.name ?? d.projectName ?? d.description ?? d.label ?? '')
          .filter(Boolean);
        this.projects   = names;
        this.facilities = names;
      },
      error: () => {
        this.projects   = [];
        this.facilities = [];
      }
    });
  }

  // ── Initial load all charts ──────────────────────────────────────────────────
  private loadAllCharts() {
    this.onLPO();
    this.onGRN();
    this.onProj();
    this.onSupp();
    this.onFacil();
  }

  // ── Filter handlers (call API then rebuild chart) ────────────────────────────
  onLPO() {
    const isMonthly = this.lpoView === 'monthly';
    const req: LpoDashboardRequest = {
      fromYear:  isMonthly ? this.lpoYear : this.lpoYears[Math.min(this.lpoYearFrom, this.lpoYearTo)],
      toYear:    isMonthly ? this.lpoYear : this.lpoYears[Math.max(this.lpoYearFrom, this.lpoYearTo)],
      fromMonth: isMonthly ? Math.min(this.lpoMonthFrom, this.lpoMonthTo) + 1 : null,
      toMonth:   isMonthly ? Math.max(this.lpoMonthFrom, this.lpoMonthTo) + 1 : null,
      companies: this.getCodes(this.lpoCompanies),
      viewType:  isMonthly ? 'M' : 'Y'
    };
    this.api.GetLpoDashboard(req).subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        // Label: prefer monthName (monthly view) → year (yearly view) → label fallback
        this.lpoChartLabels = data.map((d: any) =>
          d.monthName ?? d.label ?? (d.year != null ? String(d.year) : '') ?? ''
        );
        // Amount comes in raw OMR — convert to millions for chart display
        console.log('[LPO] raw API data sample:', data.slice(0, 2));
        this.lpoChartValues = data.map((d: any) => {
          const raw = +(d.amount ?? d.value ?? d.lpoAmount ?? 0);
          const converted = toMillions(raw);
          console.log(`[LPO] raw=${raw} → converted=${converted}`);
          return converted;
        });
        this.build('lpo');
        if (this.expandedChart === 'lpo') this.buildModal();
      },
      error: () => {
        this.lpoChartLabels = [];
        this.lpoChartValues = [];
        this.build('lpo');
      }
    });
  }

  onGRN() {
    const isMonthly = this.grnView === 'monthly';
    const fromIdx = Math.min(this.grnYearFrom,this.grnYearTo);
    const toIdx   = Math.max(this.grnYearFrom,this.grnYearTo);
    const req: GrnDashboardRequest = {
      fromYear:  isMonthly ? this.grnYear : parseInt(GRN_YEARLY.years[fromIdx]),
      toYear:    isMonthly ? this.grnYear : parseInt(GRN_YEARLY.years[toIdx]),
      fromMonth: isMonthly ? Math.min(this.grnMonthFrom,this.grnMonthTo)+1 : null,
      toMonth:   isMonthly ? Math.max(this.grnMonthFrom,this.grnMonthTo)+1 : null,
      companies: this.getCodes(this.grnCompanies),
      viewType:  isMonthly ? 'M' : 'Y'
    };
    this.api.GetGrnDashboard(req).subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.grnChartLabels = data.map((d: any) =>
          d.monthName ?? d.label ?? (d.year != null ? String(d.year) : '') ?? ''
        );
        // Convert raw OMR → millions, same as LPO
        console.log('[GRN] raw API data sample:', data.slice(0, 2));
        this.grnChartValues = data.map((d: any) => {
          const raw = +(d.amount ?? d.value ?? d.grnAmount ?? 0);
          const converted = toMillions(raw);
          console.log(`[GRN] raw=${raw} → converted=${converted}`);
          return converted;
        });
        this.build('grn');
        if (this.expandedChart === 'grn') this.buildModal();
      },
      error: () => {
        this.grnChartLabels = [];
        this.grnChartValues = [];
        this.build('grn');
      }
    });
  }

  onProj() {
    const req: ProjectDashboardRequest = {
      companies: this.projCompanies.length ? this.projCompanies : null,
      projects:  this.projProjects.length  ? this.projProjects  : null,
      year: null
    };
    this.api.GetProjectDashboard(req).subscribe({
      next: (res) => {
        this.projChartData = Array.isArray(res) ? res : (res?.data ?? []);
        this.build('projects');
        if (this.expandedChart === 'projects') this.buildModal();
      },
      error: () => { this.projChartData = null; this.build('projects'); }
    });
  }

  onSupp() {
    const req: TopSupplierRequest = {
      companies: this.getCodes(this.suppCompanies),
      yearFrom:  this.suppFromYear,
      yearTo:    this.suppToYear,
      topN:      this.suppCount
    };
    this.api.GetTopSuppliers(req).subscribe({
      next: (res) => {
        this.suppChartData = Array.isArray(res) ? res : (res?.data ?? []);
        this.build('suppliers');
        if (this.expandedChart === 'suppliers') this.buildModal();
      },
      error: () => { this.suppChartData = null; this.build('suppliers'); }
    });
  }

  onFacil() {
    const req: FacilitiesDashboardRequest = {
      projects: this.facilProjects.length  ? this.facilProjects  : null,
      vendors:  this.facilCompanies.length ? this.facilCompanies : null,
      year: null,
      month: null
    };
    this.api.GetFacilitiesDashboard(req).subscribe({
      next: (res) => {
        this.facilChartData = Array.isArray(res) ? res : (res?.data ?? []);
        this.build('facilities');
        if (this.expandedChart === 'facilities') this.buildModal();
      },
      error: () => { this.facilChartData = null; this.build('facilities'); }
    });
  }

  // ── Universal build dispatcher ───────────────────────────────────────────────
  build(name: string, ctx?: CanvasRenderingContext2D) {
    const key = ctx ? 'modal' : name;
    this.charts.get(key)?.destroy();
    const c = ctx ?? this.getGridCtx(name);
    if (!c) return;
    let chart: Chart;
    switch(name) {
      case 'lpo':        chart = this.makeLPO(c);        break;
      case 'grn':        chart = this.makeGRN(c);        break;
      case 'projects':   chart = this.makeProjects(c);   break;
      case 'suppliers':  chart = this.makeSuppliers(c);  break;
      case 'facilities': chart = this.makeFacilities(c); break;
      default: return;
    }
    this.charts.set(key, chart);
  }

  private getGridCtx(name: string): CanvasRenderingContext2D | null {
    const refs: Record<string, ElementRef<HTMLCanvasElement>> = {
      lpo: this.lpoRef, grn: this.grnRef, projects: this.projectsRef,
      suppliers: this.suppliersRef, facilities: this.facilitiesRef
    };
    return refs[name]?.nativeElement.getContext('2d') ?? null;
  }

  // ── Chart factories ──────────────────────────────────────────────────────────

  private makeLPO(ctx: CanvasRenderingContext2D): Chart {
    const from = Math.min(this.lpoMonthFrom,this.lpoMonthTo);
    const to   = Math.max(this.lpoMonthFrom,this.lpoMonthTo);
    const labels = this.lpoChartLabels.length ? this.lpoChartLabels : MONTHS_ALL.slice(from,to+1);
    const bars   = this.lpoChartValues.length ? this.lpoChartValues : LPO_ALL_VALUES.slice(from,to+1);
    const colors = labels.map((_,i)=>LPO_BAR_COLORS[i%LPO_BAR_COLORS.length]);
    // Build per-bar gradients for a richer look
    const bgColors = colors.map(clr => {
      const g = ctx.createLinearGradient(0, 0, 0, 260);
      g.addColorStop(0, clr);
      g.addColorStop(1, clr + '88');
      return g;
    });
    return new Chart(ctx,{
      type:'bar', plugins:[threedBarPlugin],
      data:{ labels, datasets:[
        {type:'bar' as any, label:'LPO Amount', data:bars,
         backgroundColor:bgColors as any, borderColor:colors, borderWidth:1.5,
         borderRadius:7, order:2},
        {type:'line' as any, label:'Trend', data:bars,
         borderColor:P_ROSE, borderWidth:3, borderDash:[6,4],
         pointBackgroundColor:P_ROSE, pointBorderColor:'#fff', pointBorderWidth:2.5,
         pointRadius:7, fill:false, tension:0.45, order:1}
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        animation:{duration:1600,easing:'easeOutBounce',delay:(c:any)=>(c.dataIndex??0)*180},
        plugins:{
          legend:{display:true,position:'top',labels:{boxWidth:12,font:{size:11},color:'#374151',usePointStyle:true}},
          tooltip:{callbacks:{label:(c:any)=>` ${(+c.parsed.y).toFixed(3)} M OMR`}}
        },
        scales:{
          x:{grid:{display:false},ticks:{color:'#6b7280',font:{size:12,weight:'bold'}}},
          y:{beginAtZero:true,grid:{color:'rgba(99,102,241,0.06)'},ticks:{color:'#6b7280',callback:(v:any)=>(+v).toFixed(2)+'M'}}
        }
      }
    });
  }

  private makeGRN(ctx: CanvasRenderingContext2D): Chart {
    const from = Math.min(this.grnYearFrom,this.grnYearTo);
    const to   = Math.max(this.grnYearFrom,this.grnYearTo);
    const labels = this.grnChartLabels.length ? this.grnChartLabels : GRN_YEARLY.years.slice(from,to+1);
    const values = this.grnChartValues.length ? this.grnChartValues : GRN_YEARLY.values.slice(from,to+1);
    const grad = ctx.createLinearGradient(0,0,0,350);
    grad.addColorStop(0,'rgba(99,102,241,0.75)');
    grad.addColorStop(0.5,'rgba(139,92,246,0.35)');
    grad.addColorStop(1,'rgba(99,102,241,0)');
    return new Chart(ctx,{
      type:'line',
      data:{labels,datasets:[{
        label:'GRN Value (M)',data:values,fill:true,backgroundColor:grad,
        borderColor:P_INDIGO,borderWidth:3.5,
        pointBackgroundColor:DONUT_VIVID.slice(0,values.length),
        pointBorderColor:'#fff',pointBorderWidth:2.5,
        pointRadius:8,pointHoverRadius:11,tension:0.45
      }]},
      options:{
        responsive:true,maintainAspectRatio:false,
        animation:{duration:2000,easing:'easeInOutQuart'},
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:(c:any)=>` ${c.parsed.y} M OMR`}}
        },
        scales:{
          x:{grid:{display:false},ticks:{color:'#6b7280',font:{size:11}}},
          y:{beginAtZero:true,grid:{color:'rgba(99,102,241,0.07)'},ticks:{color:'#6b7280',callback:(v:any)=>(+v).toFixed(2)+'M'}}
        }
      }
    });
  }

  private makeProjects(ctx: CanvasRenderingContext2D): Chart {
    const data = this.projChartData;
    console.log('[PROJECTS] raw API data sample:', (data ?? []).slice(0, 2));
    const rawLabels = data?.map((d: any) =>
      d.projectName ?? d.shortLabel ?? d.name ?? d.project ?? d.description ?? ''
    ) ?? MAIN_PROJECTS.shortLabels;
    const labels = rawLabels.map((l: string) => l.length > 22 ? l.substring(0, 21) + '…' : l);

    // Smart conversion: only divide by 1M if value looks like raw OMR (>= 100,000)
    const toM = (v: number) => toMillions(v);
    const poValues  = data?.map((d: any) =>
      toM(+(d.poAmount ?? d.poValue ?? d.po ?? d.purchaseOrderAmount ?? d.totalPoAmount ?? 0))
    ) ?? MAIN_PROJECTS.poValues;
    const grnValues = data?.map((d: any) =>
      toM(+(d.grnAmount ?? d.grnValue ?? d.grn ?? d.goodsReceivedAmount ?? d.totalGrnAmount ?? 0))
    ) ?? MAIN_PROJECTS.grnValues;

    // Vertical gradients (top → bottom)
    const poGrad = ctx.createLinearGradient(0, 0, 0, 320);
    poGrad.addColorStop(0, 'rgba(14,165,233,0.95)');
    poGrad.addColorStop(1, 'rgba(14,165,233,0.35)');
    const grnGrad = ctx.createLinearGradient(0, 0, 0, 320);
    grnGrad.addColorStop(0, 'rgba(16,185,129,0.95)');
    grnGrad.addColorStop(1, 'rgba(16,185,129,0.35)');

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'PO Value',  data: poValues,
            backgroundColor: poGrad,  borderColor: P_SKY,  borderWidth: 1.5,
            borderRadius: 6, borderSkipped: 'bottom' as any },
          { label: 'GRN Value', data: grnValues,
            backgroundColor: grnGrad, borderColor: P_TEAL, borderWidth: 1.5,
            borderRadius: 6, borderSkipped: 'bottom' as any }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1400, easing: 'easeOutQuart', delay: (c: any) => (c.dataIndex ?? 0) * 50 },
        plugins: {
          legend: { display: true, position: 'top',
            labels: { boxWidth: 12, font: { size: 11 }, color: '#374151', usePointStyle: true } },
          tooltip: { callbacks: {
            title: (items: any[]) => rawLabels[items[0]?.dataIndex] ?? '',
            label: (c: any) => ` ${c.dataset.label}: ${(+c.parsed.y).toFixed(3)} M OMR`
          }}
        },
        scales: {
          x: { grid: { display: false },
               ticks: { color: '#374151', font: { size: 9, weight: 'bold' },
                        maxRotation: 45, minRotation: 30 },
               border: { display: false } },
          y: { beginAtZero: true,
               grid: { color: 'rgba(14,165,233,0.07)' },
               ticks: { color: '#6b7280', callback: (v: any) => (+v).toFixed(2) + 'M' },
               border: { display: false } }
        }
      }
    });
  }

  private makeSuppliers(ctx: CanvasRenderingContext2D): Chart {
    const data = this.suppChartData;
    const n      = Math.min(this.suppCount, data?.length ?? TOP_SUPPLIERS.labels.length);
    const labels = data?.slice(0,n).map((d: any) => d.vendorName ?? d.supplierName ?? d.name ?? '') ?? TOP_SUPPLIERS.labels.slice(0,n);
    const toM = (v: number) => toMillions(v);
    const rawValues = data?.slice(0,n).map((d: any) => toM(+(d.totalAmountOmr ?? d.totalValue ?? d.value ?? d.amount ?? 0))) ?? TOP_SUPPLIERS.values.slice(0,n);

    // When all values are 0, Chart.js renders nothing — use equal placeholder segments
    const total = rawValues.reduce((a, b) => a + b, 0);
    const isNoData = total === 0;
    const chartValues = isNoData ? rawValues.map(() => 1) : rawValues;

    // Muted colors for no-data state, vivid for real data
    const vividColors = DONUT_VIVID.slice(0, n);
    const mutedColors = DONUT_VIVID.slice(0, n).map(c => c + '55'); // 33% opacity
    const colors = isNoData ? mutedColors : vividColors;

    return new Chart(ctx,{
      type:'doughnut', plugins:[centerLabelPlugin],
      data:{labels, datasets:[{
        data: chartValues,
        backgroundColor: colors,
        borderColor: isNoData ? '#f1f5f9' : '#fff',
        borderWidth: isNoData ? 2 : 4,
        hoverBorderColor: isNoData ? colors : vividColors,
        hoverBorderWidth: isNoData ? 2 : 6,
        hoverOffset: isNoData ? 0 : 22
      }]},
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'58%',
        animation:{
          animateRotate: true,
          animateScale: true,
          duration: 2200,
          easing: 'easeOutElastic' as any,
          delay: (ctx2: any) => ctx2.dataIndex * 80
        },
        plugins:{
          legend:{ display: false },
          tooltip:{
            enabled: !isNoData,
            backgroundColor: 'rgba(15,23,42,0.88)',
            titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 10,
            callbacks:{
              label:(c:any)=>` ${c.label}: ${(+(rawValues[c.dataIndex]??0)).toFixed(3)} M OMR`,
              afterLabel:(c:any)=>{
                const t = rawValues.reduce((a:number,b:number)=>a+b,0);
                return t > 0 ? ` Share: ${(((rawValues[c.dataIndex]??0)/t)*100).toFixed(1)}%` : '';
              }
            }
          }
        }
      }
    });
  }

  private makeFacilities(ctx: CanvasRenderingContext2D): Chart {
    const data = this.facilChartData;
    console.log('[FACILITIES] raw API data sample:', (data ?? []).slice(0, 2));
    const rawLabels = data?.map((d: any) =>
      d.facilityName ?? d.projectName ?? d.name ?? d.facility ?? d.description ?? ''
    ) ?? MAIN_FACILITIES.map(f => f.name);
    const labels = rawLabels.map((l: string) => l.length > 22 ? l.substring(0, 21) + '…' : l);

    // Smart conversion: only divide by 1M if value looks like raw OMR (>= 100,000)
    const toM = (v: number) => toMillions(v);
    const poValues  = data?.map((d: any) =>
      toM(+(d.poAmount ?? d.poValue ?? d.po ?? d.purchaseOrderAmount ?? d.totalPoAmount ?? 0))
    ) ?? MAIN_FACILITIES.map(f => f.po);
    const grnValues = data?.map((d: any) =>
      toM(+(d.grnAmount ?? d.grnValue ?? d.grn ?? d.goodsReceivedAmount ?? d.totalGrnAmount ?? 0))
    ) ?? MAIN_FACILITIES.map(f => f.grn);

    // Vertical gradients (top → bottom)
    const poGrad = ctx.createLinearGradient(0, 0, 0, 320);
    poGrad.addColorStop(0, 'rgba(139,92,246,0.95)');
    poGrad.addColorStop(1, 'rgba(139,92,246,0.35)');
    const grnGrad = ctx.createLinearGradient(0, 0, 0, 320);
    grnGrad.addColorStop(0, 'rgba(20,184,166,0.95)');
    grnGrad.addColorStop(1, 'rgba(20,184,166,0.35)');

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'PO Value',  data: poValues,
            backgroundColor: poGrad,  borderColor: P_VIOLET, borderWidth: 1.5,
            borderRadius: 6, borderSkipped: 'bottom' as any },
          { label: 'GRN Value', data: grnValues,
            backgroundColor: grnGrad, borderColor: P_TEAL,   borderWidth: 1.5,
            borderRadius: 6, borderSkipped: 'bottom' as any }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1400, easing: 'easeOutQuart', delay: (c: any) => (c.dataIndex ?? 0) * 50 },
        plugins: {
          legend: { display: true, position: 'top',
            labels: { boxWidth: 12, font: { size: 11 }, color: '#374151', usePointStyle: true } },
          tooltip: { callbacks: {
            title: (items: any[]) => rawLabels[items[0]?.dataIndex] ?? '',
            label: (c: any) => ` ${c.dataset.label}: ${(+c.parsed.y).toFixed(3)} M OMR`
          }}
        },
        scales: {
          x: { grid: { display: false },
               ticks: { color: '#374151', font: { size: 9, weight: 'bold' },
                        maxRotation: 45, minRotation: 30 },
               border: { display: false } },
          y: { beginAtZero: true,
               grid: { color: 'rgba(139,92,246,0.07)' },
               ticks: { color: '#6b7280', callback: (v: any) => (+v).toFixed(2) + 'M' },
               border: { display: false } }
        }
      }
    });
  }

  // ── Expand / close ───────────────────────────────────────────────────────────
  openExpanded(name: string) {
    this.expandedChart = name;
    document.body.style.overflow = 'hidden';
    setTimeout(()=>{
      if (!this.modalRef) return;
      this.build(name, this.modalRef.nativeElement.getContext('2d')!);
    },80);
  }

  closeExpanded() {
    this.charts.get('modal')?.destroy();
    this.charts.delete('modal');
    this.expandedChart = null;
    document.body.style.overflow = '';
  }

  private buildModal() { if(this.expandedChart&&this.modalRef) this.build(this.expandedChart,this.modalRef.nativeElement.getContext('2d')!); }

  // ── Dropdown helpers ─────────────────────────────────────────────────────────
  toggleDD(f: string) {
    const all=['lpoCoOpen','grnCoOpen','projCoOpen','projPrOpen','suppCoOpen','facilCoOpen','facilPrOpen'];
    all.forEach(k=>{ if(k!==f)(this as any)[k]=false; });
    (this as any)[f]=!(this as any)[f];
    // Reset search when opening
    const searchMap: Record<string,string> = {
      lpoCoOpen:'lpoCoSearch', grnCoOpen:'grnCoSearch',
      projCoOpen:'projCoSearch', projPrOpen:'projPrSearch', suppCoOpen:'suppCoSearch'
    };
    if ((this as any)[f] && searchMap[f]) (this as any)[searchMap[f]] = '';
  }

  // Multi-select toggle — each field is a string[]
  toggleCompany(field: string, name: string, chartFn: ()=>void) {
    (this as any)[field] = this.toggleMulti((this as any)[field], name);
    chartFn();
  }

  toggleProject(field: string, name: string, chartFn: ()=>void) {
    (this as any)[field] = this.toggleMulti((this as any)[field], name);
    chartFn();
  }

  toggleProjCompany(name: string) {
    this.projCompanies = this.toggleMulti(this.projCompanies, name);
    // Pass names directly — the API expects company names, not codes
    const names = this.projCompanies.length ? this.projCompanies : null;
    this.loadProjects(names);
    this.onProj();
  }

  toggleFacilCompany(name: string) {
    this.facilCompanies = this.toggleMulti(this.facilCompanies, name);
    // Pass names directly — the API expects company names, not codes
    const names = this.facilCompanies.length ? this.facilCompanies : null;
    this.loadProjects(names);
    this.onFacil();
  }

  clearFilter(field: string, chartFn: ()=>void) {
    (this as any)[field] = [];
    chartFn();
  }

  downloadExcel() { alert('Excel download will be available after API integration.'); }

  // ── Per-chart CSV export ──────────────────────────────────────────────────────
  private exportCSV(filename: string, rows: string[][]): void {
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv, /* BOM for Excel UTF-8 */], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  exportLPO(): void {
    const from = Math.min(this.lpoMonthFrom, this.lpoMonthTo);
    const to   = Math.max(this.lpoMonthFrom, this.lpoMonthTo);
    const labels = this.lpoChartLabels.length ? this.lpoChartLabels : MONTHS_ALL.slice(from, to + 1);
    const values = this.lpoChartValues.length ? this.lpoChartValues : LPO_ALL_VALUES.slice(from, to + 1);
    const view = this.lpoView === 'monthly' ? `${this.lpoYear} (${this.lpoFromLbl}-${this.lpoToLbl})` : `${this.lpoFromYearLbl}-${this.lpoToYearLbl}`;
    const rows: string[][] = [
      ['Monthly LPO Export', view],
      [],
      ['Period', 'LPO Amount (M OMR)'],
      ...labels.map((l, i) => [l, values[i]?.toFixed(4) ?? '0']),
      [],
      ['Total', values.reduce((a, b) => a + b, 0).toFixed(4)]
    ];
    this.exportCSV(`LPO_${this.lpoYear}_${Date.now()}.csv`, rows);
  }

  exportGRN(): void {
    const from = Math.min(this.grnYearFrom, this.grnYearTo);
    const to   = Math.max(this.grnYearFrom, this.grnYearTo);
    const labels = this.grnChartLabels.length ? this.grnChartLabels : GRN_YEARLY.years.slice(from, to + 1);
    const values = this.grnChartValues.length ? this.grnChartValues : GRN_YEARLY.values.slice(from, to + 1);
    const view = this.grnView === 'monthly' ? `${this.grnYear} (${this.grnFromMonth}-${this.grnToMonth})` : `${this.grnFromYear}-${this.grnToYear}`;
    const rows: string[][] = [
      ['GRN Value Export', view],
      [],
      ['Period', 'GRN Amount (M OMR)'],
      ...labels.map((l, i) => [l, values[i]?.toFixed(4) ?? '0']),
      [],
      ['Total', values.reduce((a, b) => a + b, 0).toFixed(4)]
    ];
    this.exportCSV(`GRN_${Date.now()}.csv`, rows);
  }

  exportProjects(): void {
    const data = this.projChartData ?? [];
    const rows: string[][] = [
      ['Main Projects — PO vs GRN'],
      [],
      ['Project', 'PO Value (M OMR)', 'GRN Value (M OMR)'],
      ...data.map((d: any) => [
        d.projectName ?? d.name ?? '',
        toMillions(+(d.poAmount ?? d.poValue ?? d.po ?? 0)).toFixed(4),
        toMillions(+(d.grnAmount ?? d.grnValue ?? d.grn ?? 0)).toFixed(4)
      ])
    ];
    this.exportCSV(`Projects_${Date.now()}.csv`, rows);
  }

  exportSuppliers(): void {
    const data = this.suppDisplayData;
    const rows: string[][] = [
      [`Top ${this.suppCount} Suppliers (${this.suppFromYear}-${this.suppToYear})`],
      [],
      ['Rank', 'Supplier Name', 'Amount (M OMR)', 'Share %'],
      ...data.map((d: any, i: number) => [
        String(i + 1),
        d.vendorName ?? d.supplierName ?? d.name ?? '',
        this.suppAmtM(d),
        this.suppShare(d).toFixed(1) + '%'
      ])
    ];
    this.exportCSV(`Suppliers_${Date.now()}.csv`, rows);
  }

  exportFacilities(): void {
    const data = this.facilChartData ?? [];
    const rows: string[][] = [
      ['Main Facilities — PO vs GRN'],
      [],
      ['Facility', 'PO Value (M OMR)', 'GRN Value (M OMR)'],
      ...data.map((d: any) => [
        d.facilityName ?? d.projectName ?? d.name ?? '',
        toMillions(+(d.poAmount ?? d.poValue ?? d.po ?? 0)).toFixed(4),
        toMillions(+(d.grnAmount ?? d.grnValue ?? d.grn ?? 0)).toFixed(4)
      ])
    ];
    this.exportCSV(`Facilities_${Date.now()}.csv`, rows);
  }

  // ── Supplier table helpers ───────────────────────────────────────────────────
  get suppDisplayData(): any[] {
    const data = this.suppChartData ?? [];
    return data.slice(0, this.suppCount);
  }

  private suppTotalM(): number {
    return this.suppDisplayData.reduce((sum, d) => {
      const raw = +(d.totalAmountOmr ?? d.totalValue ?? d.value ?? d.amount ?? 0);
      return sum + toMillions(raw);
    }, 0);
  }

  suppAmtM(d: any): string {
    const raw = +(d.totalAmountOmr ?? d.totalValue ?? d.value ?? d.amount ?? 0);
    return toMillions(raw).toFixed(3) + ' M';
  }

  suppShare(d: any): number {
    const total = this.suppTotalM();
    if (total === 0) return 0;
    const raw = +(d.totalAmountOmr ?? d.totalValue ?? d.value ?? d.amount ?? 0);
    return Math.min(100, (toMillions(raw) / total) * 100);
  }

  suppRankColor(i: number): string {
    const colors = ['#f59e0b','#6366f1','#10b981','#f43f5e','#0ea5e9',
                    '#8b5cf6','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899','#3b82f6'];
    return colors[i % colors.length];
  }

  private runGSAP() {
    gsap.fromTo('.pd-card',{opacity:0,y:40,scale:0.95},{opacity:1,y:0,scale:1,duration:0.7,stagger:0.12,ease:'back.out(1.3)'});
  }

  ngOnDestroy() {
    this.charts.forEach(c=>c.destroy());
    this.charts.clear();
    ScrollTrigger.getAll().forEach((t:any)=>t.kill());
    document.body.style.overflow='';
  }
}
