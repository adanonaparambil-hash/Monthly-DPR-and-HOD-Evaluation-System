import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Animated tower-crane loading indicator.
 *
 * Built for a construction business, so the wait reads as "site at work" rather
 * than a generic spinner. The whole thing is one inline SVG animated with CSS
 * transforms/opacity only — no GSAP, no canvas, no images — so it costs nothing
 * on the main thread while the dashboard's real work (the API round trips) is
 * in flight.
 *
 *   <app-crane-loader message="Loading LPO data" sub="Fetching purchase orders…">
 *
 * Sibling loaders on the same screen should each get a different `stagger`
 * (0–3), otherwise four cranes swing in perfect lockstep and it looks like a
 * rendering glitch instead of a site.
 */
@Component({
  selector: 'app-crane-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './crane-loader.component.html',
  styleUrls: ['./crane-loader.component.css']
})
export class CraneLoaderComponent {

  /** Primary line shown under the crane. */
  @Input() message = 'Loading';

  /** Optional quieter second line — say what is actually being fetched. */
  @Input() sub = '';

  /**
   * sm   = inline rows (batch / pagination)
   * md   = chart panels and cards
   * lg   = large fixed panels
   * auto = scales with the viewport (clamped 120px–320px). Use for full-page
   *        and full-section loaders so a wall display gets a big crane and a
   *        phone gets a small one, from the same markup.
   */
  @Input() size: 'sm' | 'md' | 'lg' | 'auto' = 'md';

  /** Lay crane and text side by side instead of stacked. Pairs with size="sm". */
  @Input() inline = false;

  /** 0–3. Phase-shifts the animation so sibling loaders don't move together. */
  @Input() stagger: 0 | 1 | 2 | 3 = 0;

  /** Indeterminate progress bar. Always hidden at size="sm" / inline. */
  @Input() showBar = true;

  get hostClasses(): string {
    return [
      'cl-root',
      `cl-${this.size}`,
      this.inline ? 'cl-inline' : '',
      this.stagger ? `cl-stg-${this.stagger}` : ''
    ].filter(Boolean).join(' ');
  }

  get barVisible(): boolean {
    return this.showBar && this.size !== 'sm' && !this.inline;
  }

  /** Screen-reader announcement for the wait, so the loader isn't silent to AT. */
  get ariaLabel(): string {
    return this.sub ? `${this.message}. ${this.sub}` : this.message;
  }
}
