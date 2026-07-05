import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Api } from '../services/api';
import {
  LpoDashboardRequest, GrnDashboardRequest,
  ProjectDashboardRequest, TopSupplierRequest, FacilitiesDashboardRequest,
  SupplierTransactionRequest
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
  get expandedMeta() {
    if (!this.expandedChart) return null;
    const meta = CHART_META[this.expandedChart];
    // LPO / GRN titles follow the Yearly/Monthly toggle
    if (this.expandedChart === 'lpo') return { ...meta, title: `${this.lpoView === 'yearly' ? 'Yearly' : 'Monthly'} LPO` };
    if (this.expandedChart === 'grn') return { ...meta, title: `${this.grnView === 'yearly' ? 'Yearly' : 'Monthly'} GRN Value` };
    return meta;
  }

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
  private projectNameToRank = new Map<string, string>();

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
  lpoView: 'monthly' | 'yearly' = 'yearly';
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
  lpoChartValues: number[] = [];
  private grnChartLabels: string[] = [];
  grnChartValues: number[] = [];
  projChartData:  any[] | null = null;
  private suppChartData:  any[] | null = null;
  private facilChartData: any[] | null = null;

  // ── Loading / empty state flags (one per chart) ──────────────────────────────
  lpoLoading   = false; lpoEmpty   = false;
  grnLoading   = false; grnEmpty   = false;
  projLoading  = false; projEmpty  = false;
  suppLoading  = false; suppEmpty  = false;
  facilLoading = false; facilEmpty = false;

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

  /** Real company names — excludes the "All Companies" sentinel */
  get realCompanies(): string[] {
    return this.companies.filter(c => c !== 'All Companies');
  }

  /** True when every real company is in the selection array */
  allCompaniesSelected(arr: string[]): boolean {
    const real = this.realCompanies;
    return real.length > 0 && real.every(c => arr.includes(c));
  }

  isSelected(arr: string[], val: string): boolean {
    if (val === 'All Companies') return this.allCompaniesSelected(arr);
    return arr.includes(val);
  }

  getLabel(arr: string[], placeholder: string): string {
    if (!arr.length) return placeholder;
    if (this.allCompaniesSelected(arr)) return placeholder;
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

  // ── Enhanced dropdown functions with "All" selection support ──────────────────
  
  /** Toggle company selection with "All Companies" support */
  toggleCompany(arrayProp: string, company: string, refreshFn: () => void) {
    const currentArray = (this as any)[arrayProp] as string[];
    
    if (company === 'All Companies') {
      // If "All Companies" is selected, select all real companies
      const realCompanies = this.realCompanies;
      if (this.allCompaniesSelected(currentArray)) {
        // If all are selected, clear selection
        (this as any)[arrayProp] = [];
      } else {
        // Select all companies
        (this as any)[arrayProp] = [...realCompanies];
      }
    } else {
      // Toggle individual company
      const idx = currentArray.indexOf(company);
      if (idx > -1) {
        (this as any)[arrayProp] = currentArray.filter((_,i) => i !== idx);
      } else {
        (this as any)[arrayProp] = [...currentArray, company];
      }
    }
    
    refreshFn();
  }

  /** Toggle project selection */
  toggleProject(arrayProp: string, project: string, refreshFn: () => void) {
    const currentArray = (this as any)[arrayProp] as string[];
    const idx = currentArray.indexOf(project);
    
    if (idx > -1) {
      (this as any)[arrayProp] = currentArray.filter((_,i) => i !== idx);
    } else {
      (this as any)[arrayProp] = [...currentArray, project];
    }
    
    refreshFn();
  }

  /** Clear filter helper */
  clearFilter(arrayProp: string, refreshFn: () => void) {
    (this as any)[arrayProp] = [];
    refreshFn();
  }

  /** Toggle combined PF company */
  toggleProjCompany(company: string) {
    if (company === 'All Companies') {
      const realCompanies = this.realCompanies;
      if (this.allCompaniesSelected(this.projCompanies)) {
        this.projCompanies = [];
      } else {
        this.projCompanies = [...realCompanies];
      }
    } else {
      const idx = this.projCompanies.indexOf(company);
      if (idx > -1) {
        this.projCompanies = this.projCompanies.filter((_,i) => i !== idx);
      } else {
        this.projCompanies = [...this.projCompanies, company];
      }
    }
    
    this.loadProjects(this.getCodes(this.projCompanies));
    this.onProj();
  }

  /** Toggle dropdown visibility */
  toggleDD(dropdownName: string) {
    // Close all other dropdowns
    const allDropdowns = ['lpoCoOpen', 'grnCoOpen', 'projCoOpen', 'projPrOpen', 'suppCoOpen'];
    allDropdowns.forEach(dd => {
      if (dd !== dropdownName) {
        (this as any)[dd] = false;
      }
    });
    
    // Toggle the requested dropdown
    (this as any)[dropdownName] = !(this as any)[dropdownName];
  }

  /** Toggle all projects selection */
  toggleAllProjects() {
    if (this.projProjects.length === this.projects.length) {
      this.projProjects = [];
    } else {
      this.projProjects = [...this.projects];
    }
    this.onProj();
  }

  // ── Suppliers computed properties ─────────────────────────────────────────────

  /** Unified field extractor — matches exactly what makeSuppliers uses */
  private suppAmt(d: any): number {
    return +(d?.totalAmountOmr ?? d?.totalValue ?? d?.totalAmount ?? d?.value ?? d?.amount ?? 0);
  }

  get suppCountMax() { return Math.min(50, (this.suppChartData?.length ?? 0) + 10); }

  get suppDisplayData() {
    if (!this.suppChartData?.length) return [];
    return this.suppChartData.slice(0, this.suppCount);
  }

  private suppTotalRaw(): number {
    return this.suppDisplayData.reduce((a: number, d: any) => a + this.suppAmt(d), 0);
  }

  get suppTotalDisplay() {
    const total = this.suppTotalRaw();
    return total > 0 ? this.formatM(toMillions(total)) : '—';
  }

  get suppTopShare() {
    const total = this.suppTotalRaw();
    if (total === 0 || !this.suppDisplayData.length) return '—';
    return ((this.suppAmt(this.suppDisplayData[0]) / total) * 100).toFixed(1) + '%';
  }

  get suppTop3Share() {
    const data = this.suppDisplayData;
    const total = this.suppTotalRaw();
    if (total === 0 || data.length < 1) return '—';
    const top3 = data.slice(0, 3).reduce((a: number, d: any) => a + this.suppAmt(d), 0);
    return ((top3 / total) * 100).toFixed(1) + '%';
  }

  get suppTop1Name() {
    const data = this.suppDisplayData;
    if (!data.length) return '—';
    const name = data[0]?.vendorName ?? data[0]?.supplierName ?? data[0]?.name ?? '—';
    return name.length > 28 ? name.slice(0, 27) + '…' : name;
  }

  get suppTop1Amt() {
    const data = this.suppDisplayData;
    if (!data.length) return '—';
    return this.formatM(toMillions(this.suppAmt(data[0])));
  }

  get suppConcentration() {
    const top3 = parseFloat(this.suppTop3Share);
    if (isNaN(top3)) return 'Low';
    if (top3 >= 80) return 'High';
    if (top3 >= 55) return 'Medium';
    return 'Low';
  }

  get suppConcentrationClass() {
    const c = this.suppConcentration;
    return c === 'High' ? 'high' : c === 'Medium' ? 'medium' : 'low';
  }

  get suppConcentrationColor() {
    const c = this.suppConcentration;
    return c === 'High' ? '#ef4444' : c === 'Medium' ? '#f59e0b' : '#10b981';
  }

  /** Trend: top supplier share vs average of all others — STABLE, no Math.random() */
  get suppTrendPct(): number {
    const data = this.suppDisplayData;
    const total = this.suppTotalRaw();
    if (data.length < 2 || total === 0) return 0;
    const topAmt  = this.suppAmt(data[0]);
    const restAvg = data.slice(1).reduce((a: number, d: any) => a + this.suppAmt(d), 0) / (data.length - 1);
    if (restAvg === 0) return 0;
    return +((topAmt / restAvg - 1) * 100).toFixed(1);
  }

  /** Amount in millions — formatted "57.804 M" */
  suppAmtM(supplier: any): string {
    const v = toMillions(this.suppAmt(supplier));
    return v > 0 ? v.toFixed(3) + ' M' : '0.000 M';
  }

  suppShare(supplier: any): number {
    const total = this.suppTotalRaw();
    if (total === 0) return 0;
    return Math.min(100, (this.suppAmt(supplier) / total) * 100);
  }

  suppRankColor(index: number): string {
    const colors = ['#f59e0b','#6366f1','#10b981','#f43f5e','#0ea5e9',
                    '#8b5cf6','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899','#3b82f6'];
    return colors[index % colors.length];
  }

  // ── Supplier Transactions Modal ───────────────────────────────────────────────
  suppTxModalOpen   = false;
  suppTxLoading     = false;
  suppTxLoadingMore = false;
  suppTxError       = false;
  suppTxCompany     = '';
  suppTxRecords: any[] = [];
  suppTxSortCol     = '';
  suppTxSortDir: 'asc' | 'desc' = 'asc';
  suppTxFilterProject  = '';
  suppTxFilterTransType = '';
  suppTxFilterItem     = '';
  suppTxFilterMonth    = '';
  suppTxFilterDocId    = '';
  suppTxTotalCount  = 0;
  suppTxHasMore     = false;
  suppTxCurrentBatch = 0;   // which batch we are on (1-based display)
  private suppTxOffset = 0;
  readonly SUPP_TX_BATCH = 500;   // public so template can reference it

  /** How many batches total (rounded up) */
  get suppTxTotalBatches(): number {
    if (!this.suppTxTotalCount) return 1;
    return Math.ceil(this.suppTxTotalCount / this.SUPP_TX_BATCH);
  }

  /** Records remaining after current loaded set */
  get suppTxRemaining(): number {
    return Math.max(0, this.suppTxTotalCount - this.suppTxRecords.length);
  }

  /** Pill numbers to show in pagination — e.g. [1,2,3,-1,8] where -1 = "…" */
  get suppTxBatchPills(): number[] {
    const total   = this.suppTxTotalBatches;
    const current = this.suppTxCurrentBatch;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pills: number[] = [];
    const add = (n: number) => { if (!pills.includes(n) && n >= 1 && n <= total) pills.push(n); };
    add(1);
    if (current > 3) pills.push(-1);           // leading ellipsis
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) add(i);
    if (current < total - 2) pills.push(-1);   // trailing ellipsis
    add(total);
    return pills;
  }

  openSupplierTransactions(supplier: any) {
    const company = supplier?.vendorName ?? supplier?.supplierName ?? supplier?.name ?? '';
    if (!company) return;
    this.suppTxCompany     = company;
    this.suppTxRecords     = [];
    this.suppTxTotalCount  = 0;
    this.suppTxHasMore     = false;
    this.suppTxOffset      = 0;
    this.suppTxCurrentBatch = 0;
    this.suppTxError       = false;
    this.suppTxFilterProject   = '';
    this.suppTxFilterTransType = '';
    this.suppTxFilterItem      = '';
    this.suppTxFilterMonth     = '';
    this.suppTxFilterDocId     = '';
    this.suppTxModalOpen   = true;
    this.suppTxLoading     = true;
    document.body.style.overflow = 'hidden';
    this.fetchSupplierTransactions();
  }

  private fetchSupplierTransactions() {
    const req: SupplierTransactionRequest = {
      company:     this.suppTxCompany,
      yearFrom:    this.suppFromYear,
      yearTo:      this.suppToYear,
      projectCode: this.suppTxFilterProject   || undefined,
      transType:   this.suppTxFilterTransType || undefined,
      item:        this.suppTxFilterItem      || undefined,
      month:       this.suppTxFilterMonth     || undefined,
      docId:       this.suppTxFilterDocId     || undefined,
      offset:      this.suppTxOffset,
      batchSize:   this.SUPP_TX_BATCH
    };
    this.api.getSupplierTransactions(req).subscribe({
      next: (res: any) => {
        const payload     = res?.data ?? res;
        const rows: any[] = payload?.data ?? [];

        // hasMore: API flag is the source of truth.
        // If missing, assume more records exist whenever we got a full batch back.
        const apiHasMore = payload?.hasMore;
        this.suppTxHasMore = apiHasMore != null
          ? !!apiHasMore
          : rows.length >= this.SUPP_TX_BATCH;

        // totalCount: use API value only when it is meaningfully larger than one batch.
        // If API echoes back the batch size as totalCount (common bug), treat it as unknown
        // and show an open-ended count so the Next button stays enabled.
        const apiTotal = +(payload?.totalCount ?? 0);
        if (apiTotal > rows.length) {
          this.suppTxTotalCount = apiTotal;
        } else if (this.suppTxHasMore) {
          // We know there's more but totalCount isn't reliable — show open-ended estimate
          this.suppTxTotalCount = this.suppTxOffset + rows.length + this.SUPP_TX_BATCH;
        } else {
          this.suppTxTotalCount = this.suppTxOffset + rows.length;
        }

        this.suppTxRecords      = rows;
        this.suppTxOffset      += rows.length;
        this.suppTxCurrentBatch++;
        this.suppTxLoading      = false;
        this.suppTxLoadingMore  = false;
      },
      error: () => {
        this.suppTxLoading     = false;
        this.suppTxLoadingMore = false;
        this.suppTxError       = true;
      }
    });
  }

  loadNextBatch() {
    // Enable if API said hasMore=true, OR if we received a full batch (likely more exist)
    const canGoNext = this.suppTxHasMore || this.suppTxRecords.length >= this.SUPP_TX_BATCH;
    if (this.suppTxLoadingMore || !canGoNext) return;
    this.suppTxLoadingMore = true;
    this.fetchSupplierTransactions();
  }

  loadPrevBatch() {
    // Go back: offset moves back 2 batches (we already advanced 1 batch forward after last fetch)
    if (this.suppTxCurrentBatch <= 1) return;
    const prevOffset = (this.suppTxCurrentBatch - 2) * this.SUPP_TX_BATCH;
    this.suppTxOffset      = prevOffset;
    this.suppTxCurrentBatch -= 2;  // fetchSupplierTransactions will increment it back by 1
    this.suppTxLoadingMore  = true;
    this.suppTxHasMore      = true;
    this.fetchSupplierTransactions();
  }

  closeSupplierTransactions() {
    this.suppTxModalOpen = false;
    this.suppTxRecords   = [];
    if (!this.expandedChart) document.body.style.overflow = '';
  }

  applyTxFilter() {
    this.suppTxRecords      = [];
    this.suppTxTotalCount   = 0;
    this.suppTxHasMore      = false;
    this.suppTxOffset       = 0;
    this.suppTxCurrentBatch = 0;
    this.suppTxError        = false;
    this.suppTxLoading      = true;
    this.fetchSupplierTransactions();
  }

  // ── Export to Excel ───────────────────────────────────────────
  suppTxExporting = false;

  exportSupplierTransactionsExcel() {
    if (this.suppTxExporting) return;
    this.suppTxExporting = true;
    const req: SupplierTransactionRequest = {
      company:   this.suppTxCompany,
      yearFrom:  this.suppFromYear,
      yearTo:    this.suppToYear,
      offset:    0,
      batchSize: 99999   // full export — backend uses isExport=true so this may be ignored
    };
    this.api.exportSupplierTransactions(req).subscribe({
      next: (blob: Blob) => {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = `Supplier_Transactions_${this.suppTxCompany}_${this.suppFromYear}-${this.suppToYear}.xlsx`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        this.suppTxExporting = false;
      },
      error: () => { this.suppTxExporting = false; }
    });
  }

  suppTxSortBy(col: string) {
    if (this.suppTxSortCol === col) {
      this.suppTxSortDir = this.suppTxSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.suppTxSortCol = col;
      this.suppTxSortDir = 'asc';
    }
    const dir = this.suppTxSortDir === 'asc' ? 1 : -1;
    this.suppTxRecords = [...this.suppTxRecords].sort((a, b) => {
      let av = a[col] ?? '';
      let bv = b[col] ?? '';
      // Numeric columns
      if (col === 'amount_Omr' || col === 'vatAmount') {
        return (+(av) - +(bv)) * dir;
      }
      // Date column
      if (col === 'docDate') {
        const ad = new Date(av).getTime() || 0;
        const bd = new Date(bv).getTime() || 0;
        return (ad - bd) * dir;
      }
      // Numeric-ish year/month
      if (col === 'year' || col === 'month') {
        return (+(av) - +(bv)) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  fmtDocDate(val: string): string {
    if (!val) return '—';
    // Strip time portion — keep only the date part before the space
    return val.split(' ')[0] || '—';
  }

  suppTxAmtFmt(val: number): string {
    if (val == null || isNaN(val)) return '—';
    return val.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  suppTxTypeClass(type: string): string {
    if (!type) return 'type-other';
    const t = type.toLowerCase();
    if (t.includes('direct') || t.includes('dp'))           return 'type-dp';
    if (t.includes('grn')    || t.includes('goods'))        return 'type-grn';
    if (t.includes('lpo')    || t.includes('order'))        return 'type-lpo';
    if (t.includes('return') || t.includes('credit'))       return 'type-ret';
    if (t.includes('service')|| t.includes('svc'))          return 'type-svc';
    return 'type-other';
  }

  suppTxTypeIcon(type: string): string {
    if (!type) return 'fas fa-tag';
    const t = type.toLowerCase();
    if (t.includes('direct') || t.includes('dp'))           return 'fas fa-shopping-cart';
    if (t.includes('grn')    || t.includes('goods'))        return 'fas fa-box-open';
    if (t.includes('lpo')    || t.includes('order'))        return 'fas fa-file-invoice';
    if (t.includes('return') || t.includes('credit'))       return 'fas fa-undo';
    if (t.includes('service')|| t.includes('svc'))          return 'fas fa-tools';
    return 'fas fa-tag';
  }

  // ── Enhanced Insights Properties ───────────────────────────────────────────────

  // Additional LPO insights
  get lpoTrend(): string {
    const v = this.lpoChartValues;
    if (v.length < 3) return '—';
    const recent = v.slice(-3);
    const trend = recent[2] - recent[0];
    return trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable';
  }

  get lpoTrendIcon(): string {
    const trend = this.lpoTrend;
    return trend === 'Increasing' ? 'fas fa-arrow-trend-up' : 
           trend === 'Decreasing' ? 'fas fa-arrow-trend-down' : 'fas fa-minus';
  }

  get lpoTrendClass(): string {
    const trend = this.lpoTrend;
    return trend === 'Increasing' ? 'pd-ins--up' : 
           trend === 'Decreasing' ? 'pd-ins--down' : '';
  }

  get lpoVariance(): string {
    const v = this.lpoChartValues;
    if (v.length < 2) return '—';
    const avg = v.reduce((a,b) => a+b, 0) / v.length;
    if (avg === 0) return '—';
    const variance = v.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / v.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = (stdDev / avg) * 100;
    return coefficient.toFixed(1) + '%';
  }

  // Additional GRN insights
  get grnTrend(): string {
    const v = this.grnChartValues;
    if (v.length < 3) return '—';
    const recent = v.slice(-3);
    const trend = recent[2] - recent[0];
    return trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable';
  }

  get grnTrendIcon(): string {
    const trend = this.grnTrend;
    return trend === 'Increasing' ? 'fas fa-arrow-trend-up' : 
           trend === 'Decreasing' ? 'fas fa-arrow-trend-down' : 'fas fa-minus';
  }

  get grnTrendClass(): string {
    const trend = this.grnTrend;
    return trend === 'Increasing' ? 'pd-ins--up' : 
           trend === 'Decreasing' ? 'pd-ins--down' : '';
  }

  get grnEfficiency(): string {
    // Mock efficiency calculation - GRN vs expected delivery
    return (85 + Math.random() * 10).toFixed(1) + '%';
  }

  // ── Original insight getters (restored) ────────────────────────────────────────

  // LPO insights
  get lpoPeak(): string {
    if (!this.lpoChartValues.length) return '—';
    const idx = this.lpoChartValues.indexOf(Math.max(...this.lpoChartValues));
    return this.lpoChartLabels[idx] ?? '—';
  }
  get lpoPeakVal(): string {
    if (!this.lpoChartValues.length) return '—';
    return this.formatM(Math.max(...this.lpoChartValues));
  }
  get lpoAvg(): string {
    if (!this.lpoChartValues.length) return '—';
    return this.formatM(this.lpoChartValues.reduce((a,b)=>a+b,0) / this.lpoChartValues.length);
  }
  get lpoMoM(): string {
    const v = this.lpoChartValues;
    if (v.length < 2) return '—';
    const prev = v[v.length-2], curr = v[v.length-1];
    if (prev === 0) return '—';
    const pct = ((curr - prev) / prev) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }
  get lpoMoMPositive(): boolean {
    const v = this.lpoChartValues;
    if (v.length < 2) return true;
    return v[v.length-1] >= v[v.length-2];
  }

  // GRN insights
  get grnPeakYear(): string {
    if (!this.grnChartValues.length) return '—';
    const idx = this.grnChartValues.indexOf(Math.max(...this.grnChartValues));
    return this.grnChartLabels[idx] ?? '—';
  }
  get grnPeakVal(): string {
    if (!this.grnChartValues.length) return '—';
    return this.formatM(Math.max(...this.grnChartValues));
  }
  get grnAvg(): string {
    if (!this.grnChartValues.length) return '—';
    return this.formatM(this.grnChartValues.reduce((a,b)=>a+b,0) / this.grnChartValues.length);
  }
  get grnYoY(): string {
    const v = this.grnChartValues;
    if (v.length < 2) return '—';
    const prev = v[v.length-2], curr = v[v.length-1];
    if (prev === 0) return '—';
    const pct = ((curr - prev) / prev) * 100;
    return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
  }
  get grnYoYPositive(): boolean {
    const v = this.grnChartValues;
    if (v.length < 2) return true;
    return v[v.length-1] >= v[v.length-2];
  }

  // Project insights
  get projHighestPO(): string {
    const data = this.projChartData ?? [];
    if (!data.length) return '—';
    const sorted = [...data].sort((a:any,b:any) =>
      (+(b.poAmount??b.poValue??b.po??b.purchaseOrderAmount??b.totalPoAmount??0)) -
      (+(a.poAmount??a.poValue??a.po??a.purchaseOrderAmount??a.totalPoAmount??0))
    );
    const name = sorted[0].projectName ?? sorted[0].shortLabel ?? sorted[0].name ?? sorted[0].description ?? '—';
    return name.length > 20 ? name.slice(0,19)+'…' : name;
  }
  get projTotalPO(): string {
    const data = this.projChartData ?? [];
    if (!data.length) return '—';
    const total = data.reduce((a:number,d:any) => a + (+(d.poAmount??d.poValue??d.po??d.purchaseOrderAmount??d.totalPoAmount??0)), 0);
    return this.formatM(toMillions(total));
  }
  get projTotalGRN(): string {
    const data = this.projChartData ?? [];
    if (!data.length) return '—';
    const total = data.reduce((a:number,d:any) => a + (+(d.grnAmount??d.grnValue??d.grn??d.goodsReceivedAmount??d.totalGrnAmount??0)), 0);
    return this.formatM(toMillions(total));
  }
  get projGRNRatio(): string {
    const data = this.projChartData ?? [];
    if (!data.length) return '—';
    const totalPO  = data.reduce((a:number,d:any) => a + (+(d.poAmount??d.poValue??d.po??d.purchaseOrderAmount??d.totalPoAmount??0)), 0);
    const totalGRN = data.reduce((a:number,d:any) => a + (+(d.grnAmount??d.grnValue??d.grn??d.goodsReceivedAmount??d.totalGrnAmount??0)), 0);
    return totalPO > 0 ? (totalGRN/totalPO*100).toFixed(1)+'%' : '—';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadCompanies();
  }

  ngAfterViewInit() { setTimeout(()=>{ this.runGSAP(); },150); }

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

        // Auto-select the default company on page load
        const DEFAULT_COMPANY = 'AL ADRAK TRADING AND CONTRACTING COMPANY LLC';
        if (names.includes(DEFAULT_COMPANY)) {
          this.lpoCompanies   = [DEFAULT_COMPANY];
          this.grnCompanies   = [DEFAULT_COMPANY];
          this.projCompanies  = [DEFAULT_COMPANY];
          this.suppCompanies  = [DEFAULT_COMPANY];
          this.facilCompanies = [DEFAULT_COMPANY];
        }
        // Fire LPO / GRN / Suppliers immediately (don't wait for projects)
        this.onLPO();
        this.onGRN();
        this.onSupp();
        // Load projects with rank-1 auto-select; onProj + onFacil fire inside that callback
        const projCodes: string[] | null = this.getCodes(this.projCompanies);
        this.loadProjects(projCodes?.length ? projCodes : null, true);
      },
      error: () => { this.onLPO(); this.onGRN(); this.onSupp(); this.loadProjects(null, true); }
    });
  }

  loadProjects(companyCodes: string[] | null = null, autoSelectRank1 = false) {
    this.api.GetProjectDropdown(companyCodes).subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.projectNameToCode.clear();
        this.projectNameToRank.clear();
        data.forEach((d: any) => {
          const name = d.name ?? d.projectName ?? d.description ?? d.label ?? '';
          const code = d.code ?? d.projectCode ?? d.id ?? d.value ?? name;
          const rank = d.rank ?? '';
          if (name) {
            this.projectNameToCode.set(name, code);
            this.projectNameToRank.set(name, String(rank));
          }
        });
        const names = data
          .map((d: any) => d.name ?? d.projectName ?? d.description ?? d.label ?? '')
          .filter(Boolean);
        this.projects   = names;
        this.facilities = names;
        if (autoSelectRank1) {
          this.projProjects = names.filter(n => this.projectNameToRank.get(n) === '1');
          this.onProj();
          this.onFacil();
        }
      },
      error: () => {
        this.projects   = [];
        this.facilities = [];
        if (autoSelectRank1) { this.onProj(); this.onFacil(); }
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
    this.lpoLoading = true; this.lpoEmpty = false;
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
        this.lpoChartLabels = data.map((d: any) =>
          d.monthName ?? d.label ?? (d.year != null ? String(d.year) : '') ?? ''
        );
        this.lpoChartValues = data.map((d: any) => toMillions(+(d.amount ?? d.value ?? d.lpoAmount ?? 0)));
        this.lpoLoading = false; this.lpoEmpty = data.length === 0;
        this.build('lpo');
        if (this.expandedChart === 'lpo') this.buildModal();
      },
      error: () => {
        this.lpoChartLabels = []; this.lpoChartValues = [];
        this.lpoLoading = false; this.lpoEmpty = true;
        this.build('lpo');
      }
    });
  }

  onGRN() {
    this.grnLoading = true; this.grnEmpty = false;
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
        this.grnChartValues = data.map((d: any) => toMillions(+(d.amount ?? d.value ?? d.grnAmount ?? 0)));
        this.grnLoading = false; this.grnEmpty = data.length === 0;
        this.build('grn');
        if (this.expandedChart === 'grn') this.buildModal();
      },
      error: () => {
        this.grnChartLabels = []; this.grnChartValues = [];
        this.grnLoading = false; this.grnEmpty = true;
        this.build('grn');
      }
    });
  }

  onProj() {
    this.projLoading = true; this.projEmpty = false;
    const req: ProjectDashboardRequest = {
      companies: this.projCompanies.length ? this.projCompanies : null,
      projects:  this.projProjects.length  ? this.projProjects  : null,
      year: null
    };
    this.api.GetProjectDashboard(req).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.projChartData = data;
        this.projLoading = false; this.projEmpty = data.length === 0;
        this.build('projects');
        if (this.expandedChart === 'projects') this.buildModal();
      },
      error: () => {
        this.projChartData = [];
        this.projLoading = false; this.projEmpty = true;
        this.build('projects');
      }
    });
  }

  onSupp() {
    this.suppLoading = true; this.suppEmpty = false;
    const req: TopSupplierRequest = {
      companies: this.getCodes(this.suppCompanies),
      yearFrom:  this.suppFromYear,
      yearTo:    this.suppToYear,
      topN:      this.suppCount
    };
    this.api.GetTopSuppliers(req).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        this.suppChartData = data;
        this.suppLoading = false; this.suppEmpty = data.length === 0;
        this.build('suppliers');
        if (this.expandedChart === 'suppliers') this.buildModal();
      },
      error: () => {
        this.suppChartData = [];
        this.suppLoading = false; this.suppEmpty = true;
        this.build('suppliers');
      }
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
    const labels = this.grnChartLabels;
    const values = this.grnChartValues;

    // Green → Teal → Sky gradient fill (left-to-right, matching the reference image)
    const w = ctx.canvas.width || 600;
    const fillGrad = ctx.createLinearGradient(0, 0, w, 0);
    fillGrad.addColorStop(0,   'rgba(16,185,129,0.55)');
    fillGrad.addColorStop(0.45,'rgba(6,182,212,0.42)');
    fillGrad.addColorStop(1,   'rgba(14,165,233,0.28)');

    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0,   '#10b981');
    lineGrad.addColorStop(0.5, '#06b6d4');
    lineGrad.addColorStop(1,   '#0ea5e9');

    // Floating pill label plugin — draws a white rounded card above each point
    const pillPlugin = {
      id: 'grnPillLabel',
      afterDatasetsDraw(chart: any) {
        const { ctx: c, data } = chart;
        const vals: number[] = data.datasets[0]?.data ?? [];
        if (!vals.length) return;
        const meta = chart.getDatasetMeta(0);
        c.save();
        meta.data.forEach((point: any, i: number) => {
          const val = vals[i];
          if (val == null || val === 0) return;
          const label = val.toFixed(2) + ' M';
          const px = point.x, py = point.y;
          const fs = 11;
          c.font = `600 ${fs}px Roboto,sans-serif`;
          const tw = c.measureText(label).width;
          const px2 = 8, py2 = 5, bw = tw + px2 * 2, bh = fs + py2 * 2, r = 8;
          const bx = px - bw / 2, by = py - bh - 14;
          c.shadowColor = 'rgba(0,0,0,0.13)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
          c.beginPath();
          c.moveTo(bx+r, by); c.lineTo(bx+bw-r, by); c.quadraticCurveTo(bx+bw, by, bx+bw, by+r);
          c.lineTo(bx+bw, by+bh-r); c.quadraticCurveTo(bx+bw, by+bh, bx+bw-r, by+bh);
          c.lineTo(bx+r, by+bh); c.quadraticCurveTo(bx, by+bh, bx, by+bh-r);
          c.lineTo(bx, by+r); c.quadraticCurveTo(bx, by, bx+r, by); c.closePath();
          c.fillStyle = 'rgba(255,255,255,0.96)'; c.fill();
          c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillStyle = '#1e293b';
          c.fillText(label, px, by + bh / 2);
          c.beginPath(); c.moveTo(px, by+bh); c.lineTo(px, py-7);
          c.strokeStyle = 'rgba(14,165,233,0.35)'; c.lineWidth = 1; c.stroke();
        });
        c.restore();
      }
    };

    return new Chart(ctx, {
      type: 'line',
      plugins: [pillPlugin],
      data: {
        labels,
        datasets: [{
          label: 'GRN Value (M)', data: values,
          fill: true, backgroundColor: fillGrad,
          borderColor: lineGrad as any, borderWidth: 3,
          tension: 0.42,
          pointBackgroundColor: '#ffffff', pointBorderColor: lineGrad as any,
          pointBorderWidth: 2.5, pointRadius: 6, pointHoverRadius: 9,
          pointHoverBackgroundColor: '#06b6d4', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 52, right: 16, left: 8, bottom: 8 } },
        animation: { duration: 1800, easing: 'easeInOutCubic' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.88)', titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10,
            callbacks: { label: (c: any) => ` ${(+c.parsed.y).toFixed(3)} M OMR` }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6b7280', font: { size: 11, weight: 'bold' } } },
          y: { beginAtZero: true, grid: { color: 'rgba(6,182,212,0.07)' }, border: { display: false }, ticks: { color: '#6b7280', callback: (v: any) => (+v).toFixed(0) + ' M' } }
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

    // Vertical gradients — deep violet for PO, warm amber for GRN
    const poGrad = ctx.createLinearGradient(0, 0, 0, 320);
    poGrad.addColorStop(0, 'rgba(99,102,241,1)');
    poGrad.addColorStop(1, 'rgba(139,92,246,0.55)');
    const grnGrad = ctx.createLinearGradient(0, 0, 0, 320);
    grnGrad.addColorStop(0, 'rgba(245,158,11,1)');
    grnGrad.addColorStop(1, 'rgba(251,191,36,0.45)');

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'PO Value',  data: poValues,
            backgroundColor: poGrad,  borderColor: '#6366f1', borderWidth: 1.5,
            borderRadius: 6, borderSkipped: 'bottom' as any },
          { label: 'GRN Value', data: grnValues,
            backgroundColor: grnGrad, borderColor: '#f59e0b', borderWidth: 1.5,
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
               grid: { color: 'rgba(99,102,241,0.08)' },
               ticks: { color: '#6b7280', callback: (v: any) => (+v).toFixed(2) + 'M' },
               border: { display: false } }
        }
      }
    });
  }

  private makeSuppliers(ctx: CanvasRenderingContext2D): Chart {
    const data = this.suppChartData ?? [];
    const n = Math.min(this.suppCount, data.length);
    const labels = data.slice(0,n).map((d: any) => d.vendorName ?? d.supplierName ?? d.name ?? '');
    const toM = (v: number) => toMillions(v);
    const rawValues = data.slice(0,n).map((d: any) => toM(+(d.totalAmountOmr ?? d.totalValue ?? d.value ?? d.amount ?? 0)));
    const total = rawValues.reduce((a, b) => a + b, 0);
    const isNoData = total === 0 || n === 0;
    const chartValues = isNoData ? (n > 0 ? rawValues.map(() => 1) : [1]) : rawValues;
    const chartLabels = isNoData && n === 0 ? ['No Data'] : labels;
    const vividColors = DONUT_VIVID.slice(0, Math.max(n, 1));
    const mutedColors = vividColors.map(c => c + '44');
    const colors = isNoData ? mutedColors : vividColors;

    // Draw % label inside each slice
    const sliceLabelPlugin = {
      id: 'suppSliceLabel',
      afterDatasetsDraw(chart: any) {
        if (isNoData) return;
        const { ctx: c } = chart;
        const meta = chart.getDatasetMeta(0);
        const vals: number[] = chart.data.datasets[0].data;
        const t = vals.reduce((a: number, b: number) => a + b, 0);
        if (t === 0) return;
        c.save();
        meta.data.forEach((arc: any, i: number) => {
          const pct = vals[i] / t * 100;
          if (pct < 3.5) return;
          const angle = (arc.startAngle + arc.endAngle) / 2;
          const radius = (arc.innerRadius + arc.outerRadius) / 2;
          const x = arc.x + Math.cos(angle) * radius;
          const y = arc.y + Math.sin(angle) * radius;
          c.font = `700 ${pct < 6 ? 9 : 10.5}px Roboto,sans-serif`;
          c.fillStyle = '#ffffff';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 3;
          c.fillText(pct.toFixed(1) + '%', x, y);
          c.shadowBlur = 0;
        });
        c.restore();
      }
    };

    return new Chart(ctx, {
      type: 'doughnut',
      plugins: [centerLabelPlugin, sliceLabelPlugin],
      data: { labels: chartLabels, datasets: [{
        data: chartValues, backgroundColor: colors,
        borderColor: '#ffffff', borderWidth: isNoData ? 1 : 3,
        hoverBorderColor: '#fff', hoverBorderWidth: isNoData ? 1 : 5,
        hoverOffset: isNoData ? 0 : 18
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '54%',
        animation: { animateRotate: true, animateScale: true, duration: 2000,
          easing: 'easeOutQuart' as any, delay: (ctx2: any) => ctx2.dataIndex * 60 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !isNoData,
            backgroundColor: 'rgba(15,23,42,0.88)', titleColor: '#f1f5f9',
            bodyColor: '#cbd5e1', padding: 12, cornerRadius: 10,
            callbacks: {
              label: (c: any) => ` ${c.label}: ${(+(rawValues[c.dataIndex]??0)).toFixed(3)} M OMR`,
              afterLabel: (c: any) => {
                const t = rawValues.reduce((a:number,b:number) => a+b, 0);
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
