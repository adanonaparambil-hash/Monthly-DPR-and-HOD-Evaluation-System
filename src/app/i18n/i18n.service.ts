import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AR } from './ar';

export type Lang = 'en' | 'ar';

const STORE_KEY = 'portal.lang';

/**
 * Arabic pilot (Phase 0) — UI only, no new package.
 *
 * The English text IS the key: `{{ 'Overview' | t }}` shows "Overview" in English and
 * the AR entry in Arabic; a missing entry falls back to the English, so nothing ever
 * renders blank. Placeholders use {name}: `t('{n} unread', { n: 3 })`.
 * Same shape as Transloco (key + params + pipe), so moving to it later is mechanical.
 *
 * Direction is NOT set on <html>: only screens that have been translated flip to RTL
 * (the shell sets dir on the sidebar/header, a page sets it on its own host). Pages
 * not in the pilot keep their English LTR layout even while Arabic is on.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.readStored());
  readonly isAr = computed(() => this.lang() === 'ar');
  readonly dir = computed(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  /** fires after every switch — screens that build text in TS re-run their mapping */
  readonly changed$ = new Subject<Lang>();

  setLang(l: Lang): void {
    if (l === this.lang()) { return; }
    this.lang.set(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* private mode */ }
    this.changed$.next(l);
  }

  toggle(): void { this.setLang(this.lang() === 'ar' ? 'en' : 'ar'); }

  /** Translate an English phrase; {name} placeholders are filled from params. */
  t(text: string | null | undefined, params?: Record<string, unknown>): string {
    const src = text ?? '';
    let s = this.lang() === 'ar' ? (AR[src] ?? src) : src;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
    }
    return s;
  }

  /** Date/number locale: Arabic month and day names with Western digits (Oman business usage). */
  locale(): string { return this.lang() === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB'; }

  private readStored(): Lang {
    try { return localStorage.getItem(STORE_KEY) === 'ar' ? 'ar' : 'en'; } catch { return 'en'; }
  }
}
