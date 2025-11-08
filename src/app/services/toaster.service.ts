import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToasterService {
  private toasts: ToastMessage[] = [];
  private toastSubject = new BehaviorSubject<ToastMessage[]>([]);

  constructor() { }

  getToasts() {
    return this.toastSubject.asObservable();
  }

  showSuccess(title: string, message: string, duration: number = 4000) {
    this.addToast('success', title, message, duration);
  }

  showError(title: string, message: string, duration: number = 5000) {
    this.addToast('error', title, message, duration);
  }

  showWarning(title: string, message: string, duration: number = 4000) {
    this.addToast('warning', title, message, duration);
  }

  showInfo(title: string, message: string, duration: number = 4000) {
    this.addToast('info', title, message, duration);
  }

  private addToast(type: ToastMessage['type'], title: string, message: string, duration: number) {
    const id = Date.now().toString();
    const toast: ToastMessage = { id, type, title, message, duration };
    
    this.toasts.push(toast);
    this.toastSubject.next([...this.toasts]);

    if (duration > 0) {
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.toastSubject.next([...this.toasts]);
  }

  clearAll() {
    this.toasts = [];
    this.toastSubject.next([]);
  }
}