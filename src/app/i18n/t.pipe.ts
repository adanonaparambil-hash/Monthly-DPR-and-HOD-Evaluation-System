import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/** `{{ 'Overview' | t }}` · `{{ '{n} new' | t:{ n: count } }}` — impure so a language switch repaints at once. */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(text: string | null | undefined, params?: Record<string, unknown>): string {
    return this.i18n.t(text, params);
  }
}
