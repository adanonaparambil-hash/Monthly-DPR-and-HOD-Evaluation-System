import { Component, AfterViewInit, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
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

// ── 3-D bar faces plugin ────────────────────────────────────────────────────
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
    const total = (chart.data.datasets[0]?.data as number[]).reduce((a, b) => a + b, 0);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px Roboto,sans-serif'; ctx.fillStyle = '#1e293b';
    ctx.fillText(total.toFixed(1) + ' M', cx, cy - 10);
    ctx.font = '11px Roboto,sans-serif'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('Total OMR', cx, cy + 12);
    ctx.restore();
  }
};

// ── Modern vivid palette (light-friendly) ───────────────────────────────────
const P_EMERALD = '#10b981'; const P_EMERALD_L = '#34d399';
const P_INDIGO  = '#6366f1'; const P_INDIGO_L  = '#818cf8';
const P_SKY     = '#0ea5e9'; const P_SKY_L     = '#38bdf8';
const P_AMBER   = '#f59e0b'; const P_AMBER_L   = '#fbbf24';
const P_VIOLET  = '#8b5cf6'; const P_VIOLET_L  = '#a78bfa';

const DONUT_VIVID = [
  '#10b981','#6366f1','#f59e0b','#0ea5e9','#8b5cf6',
  '#ef4444','#14b8a6','#f97316','#06b6d4','#84cc16','#ec4899','#3b82f6'
];

const LPO_BAR_COLORS = ['#10b981','#34d399','#059669','#6ee7b7'];

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
  lpo:       {title:'Monthly LPO',          icon:'fas fa-shopping-cart', type:'3D Bar + Trend',  clr:'emerald'},
  grn:       {title:'GRN Value (Yearly)',   icon:'fas fa-receipt',        type:'Area Chart',      clr:'indigo'},
  projects:  {title:'Main Projects',        icon:'fas fa-project-diagram',type:'Bar + Line',      clr:'sky'},
  suppliers: {title:'Top Suppliers',        icon:'fas fa-industry',       type:'Doughnut',        clr:'amber'},
  facilities:{title:'Main Facilities',      icon:'fas fa-building',       type:'Grouped H. Bar',  clr:'violet'},
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
  lpoYear=2026; lpoMonthFrom=0; lpoMonthTo=3; lpoView:'monthly'|'yearly'='monthly';
  lpoYearFrom=0; lpoYearTo=3; // yearly-mode year range (index into lpoYears)
  grnYearFrom=0; grnYearTo=9; grnMonthFrom=0; grnMonthTo=11; grnView:'yearly'|'monthly'='yearly';
  suppYearFrom=0; suppYearTo=16; suppCount=10;

  readonly lpoYears    = [2023,2024,2025,2026];
  readonly monthLabels = MONTHS_ALL;
  readonly grnYears    = GRN_YEARLY.years;

  // ── Chart data from API ──────────────────────────────────────────────────────
  private lpoChartLabels: string[] = [];
  private lpoChartValues: number[] = [];
  private grnChartLabels: string[] = [];
  private grnChartValues: number[] = [];
  private projChartData:  any[] | null = null;
  private suppChartData:  any[] | null = null;
  private facilChartData: any[] | null = null;

  // ── Computed display values ──────────────────────────────────────────────────
  get lpoTotal()    { const v = this.lpoChartValues.length ? this.lpoChartValues : LPO_ALL_VALUES.slice(Math.min(this.lpoMonthFrom,this.lpoMonthTo),Math.max(this.lpoMonthFrom,this.lpoMonthTo)+1); return Math.round(v.reduce((a,b)=>a+b,0)*100)/100; }
  get grnTotal()    { const v = this.grnChartValues.length ? this.grnChartValues : GRN_YEARLY.values.slice(this.grnYearFrom,this.grnYearTo+1); return Math.round(v.reduce((a,b)=>a+b,0)*100)/100; }
  get lpoFromLbl()     { return MONTHS_ALL[Math.min(this.lpoMonthFrom,this.lpoMonthTo)]; }
  get lpoToLbl()       { return MONTHS_ALL[Math.max(this.lpoMonthFrom,this.lpoMonthTo)]; }
  get lpoFromYearLbl() { return this.lpoYears[Math.min(this.lpoYearFrom,this.lpoYearTo)]; }
  get lpoToYearLbl()   { return this.lpoYears[Math.max(this.lpoYearFrom,this.lpoYearTo)]; }
  get grnFromYear() { return GRN_YEARLY.years[Math.min(this.grnYearFrom,this.grnYearTo)]; }
  get grnToYear()   { return GRN_YEARLY.years[Math.max(this.grnYearFrom,this.grnYearTo)]; }
  get grnFromMonth(){ return MONTHS_ALL[Math.min(this.grnMonthFrom,this.grnMonthTo)]; }
  get grnToMonth()  { return MONTHS_ALL[Math.max(this.grnMonthFrom,this.grnMonthTo)]; }
  get suppFromYear(){ return 2010+this.suppYearFrom; }
  get suppToYear()  { return 2010+this.suppYearTo; }

  formatM(val: number): string {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + ' M';
    if (val >= 1_000)     return (val / 1_000).toFixed(2) + ' K';
    return val.toFixed(2) + ' M';
  }

  // ── Multi-select helpers ─────────────────────────────────────────────────────
  isSelected(arr: string[], val: string): boolean { return arr.includes(val); }

  getLabel(arr: string[], placeholder: string): string {
    if (!arr.length) return placeholder;
    if (arr.length === 1) return arr[0].length > 16 ? arr[0].slice(0,15)+'…' : arr[0];
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
          this.companyNameToCode.set(d.name, d.code);
        });
        this.companies = ['All Companies', ...data.map((d: any) => d.name).filter(Boolean)];
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
          this.projectNameToCode.set(d.name, d.code);
        });
        const names = data.map((d: any) => d.name).filter(Boolean);
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
        this.lpoChartLabels = data.map((d: any) => d.label ?? d.month ?? String(d.year) ?? '');
        this.lpoChartValues = data.map((d: any) => +(d.value ?? d.lpoAmount ?? d.amount ?? 0));
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
    const fromIdx = Math.min(this.grnYearFrom,this.grnYearTo);
    const toIdx   = Math.max(this.grnYearFrom,this.grnYearTo);
    const req: GrnDashboardRequest = {
      fromYear:  parseInt(GRN_YEARLY.years[fromIdx]),
      toYear:    parseInt(GRN_YEARLY.years[toIdx]),
      fromMonth: this.grnView === 'monthly' ? Math.min(this.grnMonthFrom,this.grnMonthTo)+1 : null,
      toMonth:   this.grnView === 'monthly' ? Math.max(this.grnMonthFrom,this.grnMonthTo)+1 : null,
      companies: this.getCodes(this.grnCompanies),
      viewType:  this.grnView === 'monthly' ? 'M' : 'Y'
    };
    this.api.GetGrnDashboard(req).subscribe({
      next: (res) => {
        const data: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.grnChartLabels = data.map((d: any) => d.label ?? String(d.year ?? d.month ?? ''));
        this.grnChartValues = data.map((d: any) => +(d.value ?? d.grnAmount ?? d.amount ?? 0));
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
      companies: this.getCodes(this.projCompanies),
      projects:  this.getProjCodes(this.projProjects),
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
      projects: this.getProjCodes(this.facilProjects),
      vendors:  this.getCodes(this.facilCompanies),
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
    return new Chart(ctx,{
      type:'bar', plugins:[threedBarPlugin],
      data:{ labels, datasets:[
        {type:'bar' as any, label:'LPO Amount', data:bars, backgroundColor:colors, borderColor:colors, borderWidth:1, borderRadius:5, order:2},
        {type:'line' as any, label:'Trend', data:bars, borderColor:P_INDIGO, borderWidth:2.5, borderDash:[5,4],
         pointBackgroundColor:P_INDIGO, pointBorderColor:'#fff', pointBorderWidth:2, pointRadius:6,
         fill:false, tension:0.4, order:1}
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        animation:{duration:1600,easing:'easeOutBounce',delay:(c:any)=>(c.dataIndex??0)*180},
        plugins:{
          legend:{display:true,position:'top',labels:{boxWidth:12,font:{size:11},color:'#374151'}},
          tooltip:{callbacks:{label:(c:any)=>` ${c.parsed.y} M OMR`}}
        },
        scales:{
          x:{grid:{display:false},ticks:{color:'#6b7280',font:{size:12,weight:'bold'}}},
          y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#6b7280',callback:(v:any)=>v+'M'}}
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
    grad.addColorStop(0,'rgba(99,102,241,0.7)');
    grad.addColorStop(0.6,'rgba(99,102,241,0.15)');
    grad.addColorStop(1,'rgba(99,102,241,0)');
    return new Chart(ctx,{
      type:'line',
      data:{labels,datasets:[{
        label:'GRN Value (M)',data:values,fill:true,backgroundColor:grad,
        borderColor:P_INDIGO,borderWidth:3,
        pointBackgroundColor:P_INDIGO,pointBorderColor:'#fff',pointBorderWidth:2.5,
        pointRadius:7,pointHoverRadius:10,tension:0.4
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
          y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#6b7280',callback:(v:any)=>v+'M'}}
        }
      }
    });
  }

  private makeProjects(ctx: CanvasRenderingContext2D): Chart {
    const data = this.projChartData;
    const labels   = data?.map((d: any) => d.shortLabel ?? d.projectName ?? d.name ?? '') ?? MAIN_PROJECTS.shortLabels;
    const poValues = data?.map((d: any) => +(d.poValue ?? d.po ?? 0)) ?? MAIN_PROJECTS.poValues;
    const grnValues= data?.map((d: any) => +(d.grnValue ?? d.grn ?? 0)) ?? MAIN_PROJECTS.grnValues;
    return new Chart(ctx,{
      type:'bar', plugins:[threedBarPlugin],
      data:{labels,datasets:[
        {type:'bar' as any,label:'PO Value',data:poValues,
         backgroundColor:P_SKY,borderColor:P_SKY,borderWidth:1,borderRadius:4,order:2},
        {type:'line' as any,label:'GRN Value',data:grnValues,
         borderColor:P_AMBER,borderWidth:2.5,backgroundColor:'rgba(245,158,11,0.1)',
         pointBackgroundColor:P_AMBER,pointBorderColor:'#fff',pointBorderWidth:2,
         pointRadius:6,fill:true,tension:0.35,order:1}
      ]},
      options:{
        responsive:true,maintainAspectRatio:false,
        animation:{duration:1500,easing:'easeOutQuart',delay:(c:any)=>(c.dataIndex??0)*60},
        plugins:{
          legend:{display:true,position:'top',labels:{boxWidth:12,font:{size:11},color:'#374151'}},
          tooltip:{callbacks:{label:(c:any)=>` ${c.dataset.label}: ${c.parsed.y} M OMR`}}
        },
        scales:{
          x:{grid:{display:false},ticks:{color:'#6b7280',font:{size:9},maxRotation:40,minRotation:30}},
          y:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.04)'},ticks:{color:'#6b7280',callback:(v:any)=>v+'M'}}
        }
      }
    });
  }

  private makeSuppliers(ctx: CanvasRenderingContext2D): Chart {
    const data = this.suppChartData;
    const n      = Math.min(this.suppCount, data?.length ?? TOP_SUPPLIERS.labels.length);
    const labels = data?.slice(0,n).map((d: any) => d.supplierName ?? d.name ?? '') ?? TOP_SUPPLIERS.labels.slice(0,n);
    const values = data?.slice(0,n).map((d: any) => +(d.totalValue ?? d.value ?? d.amount ?? 0)) ?? TOP_SUPPLIERS.values.slice(0,n);
    const colors = DONUT_VIVID.slice(0,n);
    return new Chart(ctx,{
      type:'doughnut', plugins:[centerLabelPlugin],
      data:{labels,datasets:[{
        data:values,backgroundColor:colors,borderColor:'#fff',borderWidth:3,hoverBorderWidth:4,hoverOffset:12
      }]},
      options:{
        responsive:true,maintainAspectRatio:false,cutout:'60%',
        animation:{animateRotate:true,animateScale:true,duration:1800,easing:'easeOutCirc'},
        plugins:{
          legend:{
            display:true,position:'right',
            labels:{boxWidth:11,font:{size:9},color:'#374151',padding:8,
              generateLabels:(chart:any)=>chart.data.labels.map((lbl:string,i:number)=>({
                text:`${lbl.length>22?lbl.substring(0,21)+'…':lbl}  (${chart.data.datasets[0].data[i]}M)`,
                fillStyle:chart.data.datasets[0].backgroundColor[i],strokeStyle:'#fff',lineWidth:1,index:i
              }))
            }
          },
          tooltip:{callbacks:{
            label:(c:any)=>` ${c.label}: ${c.parsed} M OMR`,
            afterLabel:(c:any)=>{const t=(c.dataset.data as number[]).reduce((a:number,b:number)=>a+b,0);return ` Share: ${((c.parsed/t)*100).toFixed(1)}%`;}
          }}
        }
      }
    });
  }

  private makeFacilities(ctx: CanvasRenderingContext2D): Chart {
    const data = this.facilChartData;
    const labels   = data?.map((d: any) => d.facilityName ?? d.projectName ?? d.name ?? '') ?? MAIN_FACILITIES.map(f=>f.name);
    const poValues = data?.map((d: any) => +(d.poValue ?? d.po ?? 0)) ?? MAIN_FACILITIES.map(f=>f.po);
    const grnValues= data?.map((d: any) => +(d.grnValue ?? d.grn ?? 0)) ?? MAIN_FACILITIES.map(f=>f.grn);
    const poGrad = ctx.createLinearGradient(300,0,0,0);
    poGrad.addColorStop(0,'rgba(139,92,246,0.9)');
    poGrad.addColorStop(1,'rgba(139,92,246,0.5)');
    const grnGrad = ctx.createLinearGradient(300,0,0,0);
    grnGrad.addColorStop(0,'rgba(14,165,233,0.9)');
    grnGrad.addColorStop(1,'rgba(14,165,233,0.5)');
    return new Chart(ctx,{
      type:'bar',
      data:{
        labels,
        datasets:[
          {label:'PO Value', data:poValues,
           backgroundColor:poGrad, borderColor:P_VIOLET, borderWidth:1.5,
           borderRadius:6, borderSkipped:false},
          {label:'GRN Value',data:grnValues,
           backgroundColor:grnGrad, borderColor:P_SKY, borderWidth:1.5,
           borderRadius:6, borderSkipped:false}
        ]
      },
      options:{
        indexAxis:'y' as any,
        responsive:true, maintainAspectRatio:false,
        animation:{duration:1600, easing:'easeOutQuart', delay:(c:any)=>(c.dataIndex??0)*55},
        plugins:{
          legend:{display:true,position:'top',labels:{boxWidth:12,font:{size:11},color:'#374151'}},
          tooltip:{callbacks:{label:(c:any)=>` ${c.dataset.label}: ${c.parsed.x} M OMR`}}
        },
        scales:{
          x:{beginAtZero:true,grid:{color:'rgba(0,0,0,0.05)'},
             ticks:{color:'#6b7280',callback:(v:any)=>v+'M'},
             border:{display:false}},
          y:{grid:{display:false},
             ticks:{color:'#374151',font:{size:10,weight:'bold'}},
             border:{display:false}}
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
    const codes = this.getCodes(this.projCompanies);
    this.loadProjects(codes);
    this.onProj();
  }

  toggleFacilCompany(name: string) {
    this.facilCompanies = this.toggleMulti(this.facilCompanies, name);
    const codes = this.getCodes(this.facilCompanies);
    this.loadProjects(codes);
    this.onFacil();
  }

  clearFilter(field: string, chartFn: ()=>void) {
    (this as any)[field] = [];
    chartFn();
  }

  downloadExcel() { alert('Excel download will be available after API integration.'); }

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
