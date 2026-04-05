import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NoticePopupService {
  private noticeSubject = new BehaviorSubject<any>(null);
  notice$ = this.noticeSubject.asObservable();

  showNotice(notice: any) {
    this.noticeSubject.next(notice);
  }

  clear() {
    this.noticeSubject.next(null);
  }
}
