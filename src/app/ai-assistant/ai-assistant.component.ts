import { Component, OnInit, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAssistantService } from '../services/ai-assistant.service';
import { AuthService } from '../services/auth.service';

interface ChatMsg {
  from: 'user' | 'ai';
  text: string;
  html?: string;      // rendered version for AI messages
  time: Date;
  error?: boolean;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('msgList') msgList?: ElementRef<HTMLDivElement>;

  /** Pilot rollout gate: empty list = visible to ALL users.
   *  To restrict again, add empids, e.g. ['ITS48', 'ITS41']. */
  private static readonly PILOT_USERS: string[] = [];
  isAllowed = false;

  isOpen  = false;
  sending = false;
  input   = '';
  messages: ChatMsg[] = [];
  sessionId = '';
  userType  = 'E';   // 'E' | 'H' | 'C' — same convention as the rest of the app
  userName  = '';

  private shouldScroll = false;

  constructor(private ai: AiAssistantService, private auth: AuthService) {}

  ngOnInit(): void {
    const user = this.auth.getUser();
    this.userName = user?.employeeName ?? user?.name ?? '';
    const code = ((user?.isHOD || user?.role || user?.userType || '') as string)
      .toString().toUpperCase();
    this.userType = code === 'H' ? 'H' : code === 'C' ? 'C' : 'E';
    this.sessionId = this.newSessionId();

    // Pilot visibility check (same userId resolution as log-analytics)
    const userId = (user?.empId ?? user?.employeeId ?? user?.userId ?? user?.id ?? '')
      .toString().trim().toUpperCase();
    const pilot = AiAssistantComponent.PILOT_USERS;
    this.isAllowed = pilot.length === 0 || pilot.includes(userId);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.msgList) {
      this.msgList.nativeElement.scrollTop = this.msgList.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  /** Suggested questions shown when the chat is empty, per role */
  get suggestions(): string[] {
    if (this.userType === 'C') {
      return [
        'Compare all departments this month',
        'Which employees need immediate attention?',
        'What repetitive work should be automated?'
      ];
    }
    if (this.userType === 'H') {
      return [
        'How is my team performing this month?',
        'Who is underutilized in my department?',
        'Who has not been reporting DPR consistently?'
      ];
    }
    return [
      'How is my performance this month?',
      'What can I do to improve?',
      'Summarize my work this week'
    ];
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.shouldScroll = true;
  }

  useSuggestion(q: string): void {
    this.input = q;
    this.send();
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.sending) return;

    this.messages.push({ from: 'user', text, time: new Date() });
    this.input = '';
    this.sending = true;
    this.shouldScroll = true;

    this.ai.ask(text, this.sessionId).subscribe({
      next: res => {
        const answer = res?.answer || 'Sorry, I could not generate an answer.';
        this.messages.push({
          from: 'ai', text: answer, html: this.renderMarkdownLite(answer), time: new Date()
        });
        this.sending = false;
        this.shouldScroll = true;
      },
      error: () => {
        this.messages.push({
          from: 'ai',
          text: 'The assistant is busy or unavailable right now. Please try again in a minute.',
          time: new Date(),
          error: true
        });
        this.sending = false;
        this.shouldScroll = true;
      }
    });
  }

  clearChat(): void {
    this.messages = [];
    this.sessionId = this.newSessionId();  // fresh conversation memory
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  private newSessionId(): string {
    return (crypto as any)?.randomUUID?.() ??
      `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Minimal safe markdown rendering (no external libs):
   * escapes HTML first, then supports **bold**, bullet lines and line breaks.
   */
  private renderMarkdownLite(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<strong>$1</strong>')
      .replace(/^## (.+)$/gm, '<strong>$1</strong>')
      .replace(/^[-*] (.+)$/gm, '• $1')
      .replace(/\n/g, '<br>');
  }
}
