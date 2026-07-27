import { Component, OnInit, ElementRef, ViewChild, AfterViewChecked, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAssistantService } from '../services/ai-assistant.service';
import { AuthService } from '../services/auth.service';
import { renderMarkdown } from '../shared/markdown-render';
import { exportMarkdownPdf } from '../shared/markdown-pdf';

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
  styleUrls: ['./ai-assistant.component.css'],
  // AI answers are injected via [innerHTML]; emulated encapsulation would stop
  // the .aia-bubble content styles (tables, headings) from reaching that HTML.
  // All selectors are `aia-`-prefixed, so going global is safe.
  encapsulation: ViewEncapsulation.None
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
        'Who has not submitted their DPR?'
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
          from: 'ai', text: answer, html: renderMarkdown(answer), time: new Date()
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

  /** Export one AI answer as a PDF (same engine as the AI Insight Report). */
  exportMessage(m: ChatMsg): void {
    if (m.from !== 'ai' || !m.text) return;
    const when = new Date(m.time);
    const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-` +
      `${String(when.getDate()).padStart(2, '0')}_${String(when.getHours()).padStart(2, '0')}` +
      `${String(when.getMinutes()).padStart(2, '0')}`;
    const scope = this.userType === 'C' ? 'Company-wide'
                : this.userType === 'H' ? 'Department' : 'Personal';
    exportMarkdownPdf({
      markdown: m.text,
      headerTitle: 'DPR AI Assistant',
      headerSubtitle: `${scope} insight   ·   ${when.toLocaleString()}`,
      footerText: 'AL ADRAK — DPR AI Assistant',
      filename: `DPR-Chat-${scope}-${stamp}.pdf`,
    });
  }

  /** Export the whole conversation (all Q&A turns) as one PDF. */
  exportChat(): void {
    const turns = this.messages.filter(m => !m.error);
    if (turns.length === 0) return;
    const md = turns.map(m =>
      m.from === 'user' ? `**Question:** ${m.text}` : m.text
    ).join('\n\n---\n\n');
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}` +
      `${String(now.getMinutes()).padStart(2, '0')}`;
    exportMarkdownPdf({
      markdown: md,
      headerTitle: 'DPR AI Assistant — Conversation',
      headerSubtitle: `${turns.length} messages   ·   ${now.toLocaleString()}`,
      footerText: 'AL ADRAK — DPR AI Assistant',
      filename: `DPR-Chat-Conversation-${stamp}.pdf`,
    });
  }
}
