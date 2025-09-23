import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class Theme {
  private isDarkModeSubject = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.isDarkModeSubject.asObservable();

  constructor() {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('darkMode');
    const isDark = savedTheme === 'true';
    this.isDarkModeSubject.next(isDark);
    this.applyTheme(isDark);
  }

  toggleTheme(): void {
    const newTheme = !this.isDarkModeSubject.value;
    this.isDarkModeSubject.next(newTheme);
    localStorage.setItem('darkMode', newTheme.toString());
    this.applyTheme(newTheme);
  }

  private applyTheme(isDark: boolean): void {
    const root = document.documentElement;
    const body = document.body;

    if (isDark) {
      body.classList.add('dark-theme');
      // Dark theme colors
      root.style.setProperty('--primary-color', '#1f2937');
      root.style.setProperty('--secondary-color', '#374151');
      root.style.setProperty('--accent-color', '#cc9933');
      root.style.setProperty('--text-primary', '#f9fafb');
      root.style.setProperty('--text-secondary', '#d1d5db');
      root.style.setProperty('--background-primary', '#111827');
      root.style.setProperty('--background-secondary', '#1f2937');
      root.style.setProperty('--border-color', '#374151');
      root.style.setProperty('--success-color', '#34d399');
      root.style.setProperty('--warning-color', '#fbbf24');
      root.style.setProperty('--error-color', '#f87171');
      root.style.setProperty('--info-color', '#60a5fa');
    } else {
      body.classList.remove('dark-theme');
      // Light theme - Company colors
      root.style.setProperty('--primary-color', '#cc9933');
      root.style.setProperty('--secondary-color', '#2f4f2f');
      root.style.setProperty('--accent-color', '#cc9933');
      root.style.setProperty('--text-primary', '#1f2937');
      root.style.setProperty('--text-secondary', '#6b7280');
      root.style.setProperty('--background-primary', '#ffffff');
      root.style.setProperty('--background-secondary', '#f9fafb');
      root.style.setProperty('--border-color', '#e5e7eb');
      root.style.setProperty('--success-color', '#22c55e');
      root.style.setProperty('--warning-color', '#f59e0b');
      root.style.setProperty('--error-color', '#ef4444');
      root.style.setProperty('--info-color', '#3b82f6');
    }

    // Update gradients
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, var(--primary-color), var(--secondary-color))`);
    root.style.setProperty('--gradient-secondary', `linear-gradient(135deg, var(--secondary-color), var(--primary-color))`);
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, var(--accent-color), #b8860b)`);
  }

  get isDarkMode(): boolean {
    return this.isDarkModeSubject.value;
  }
}
