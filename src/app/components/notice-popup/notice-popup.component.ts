import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Api } from '../../services/api';
import { NoticePopupService } from '../../services/notice-popup.service';

@Component({
  selector: 'app-notice-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notice-popup.component.html',
  styleUrls: ['./notice-popup.component.css']
})
export class NoticePopupComponent implements OnInit, OnDestroy {
  notices: any[] = [];
  currentIndex = 0;
  showPopup = false;
  private userId = '';
  private sub!: Subscription;

  constructor(private api: Api, private noticePopupService: NoticePopupService) {}

  ngOnInit() {
    const user = JSON.parse(localStorage.getItem('current_user') || '{}');
    this.userId = user?.empId ?? '';
    if (this.userId) this.loadNotices();

    // Listen for externally triggered notices (from notification click)
    this.sub = this.noticePopupService.notice$.subscribe(notice => {
      if (notice) {
        this.notices = [notice];
        this.currentIndex = 0;
        this.showPopup = true;
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadNotices() {
    this.api.getUserNotices(this.userId, 0, 'Y').subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        this.notices = list.filter((n: any) => n.isRead === 'N' && n.showOnLogin === 'Y');
        if (this.notices.length > 0) {
          this.currentIndex = 0;
          this.showPopup = true;
        }
      },
      error: () => {}
    });
  }

  get current() { return this.notices[this.currentIndex] ?? null; }
  get totalCount() { return this.notices.length; }

  getPriorityClass(priority: string): string {
    const p = (priority ?? '').toLowerCase();
    if (p === 'high') return 'priority-high';
    if (p === 'low') return 'priority-low';
    return 'priority-medium';
  }

  markAsRead() {
    if (!this.current) return;
    this.api.markNoticeAsRead(this.current.noticeId, this.userId).subscribe({ error: () => {} });
    this.nextOrClose();
  }

  close() { this.nextOrClose(); }

  private nextOrClose() {
    if (this.currentIndex < this.notices.length - 1) {
      this.currentIndex++;
    } else {
      this.showPopup = false;
      this.noticePopupService.clear();
    }
  }
}
