import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { DEMO_CHAT_GROUPS, DEMO_MESSAGES } from './demo-data';

interface ChatGroup {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  memberCount?: number;
  isPinned?: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  timestamp: Date;
  isCurrentUser: boolean;
  messageType?: 'text' | 'file' | 'image';
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  // Chat groups and messages
  chatGroups: ChatGroup[] = [];
  filteredGroups: ChatGroup[] = [];
  selectedGroup: ChatGroup | null = null;
  messages: ChatMessage[] = [];
  
  // UI state
  searchQuery = '';
  newMessage = '';
  isLoading = false;
  isTyping = false;
  showEmojiPicker = false;
  
  // User info
  currentUser: any;
  
  // Polling for new messages
  private messagePollingInterval: any;
  private shouldScrollToBottom = true;

  constructor(
    private authService: AuthService
  ) {
    this.currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
  }

  ngOnInit() {
    this.loadChatGroups();
    this.startMessagePolling();
  }

  ngOnDestroy() {
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
    }
  }

  loadChatGroups() {
    this.isLoading = true;
    
    // Use demo data - replace with actual API call
    this.chatGroups = [...DEMO_CHAT_GROUPS];
    this.filteredGroups = [...this.chatGroups];
    this.isLoading = false;
    
    // Auto-select first group
    if (this.chatGroups.length > 0) {
      this.selectGroup(this.chatGroups[0]);
    }
  }

  selectGroup(group: ChatGroup) {
    this.selectedGroup = group;
    this.loadMessages(group.id);
    this.shouldScrollToBottom = true;
    
    // Mark as read
    group.unreadCount = 0;
  }

  loadMessages(groupId: string) {
    this.isLoading = true;
    
    // Use demo data - replace with actual API call
    const demoMessages = DEMO_MESSAGES[groupId as keyof typeof DEMO_MESSAGES] || [];
    
    // Convert demo messages to component format
    this.messages = demoMessages.map(msg => ({
      ...msg,
      isCurrentUser: msg.senderId === (this.currentUser.empId || 'current')
    }));
    
    this.isLoading = false;
  }

  searchGroups() {
    if (!this.searchQuery.trim()) {
      this.filteredGroups = [...this.chatGroups];
      return;
    }
    
    this.filteredGroups = this.chatGroups.filter(group =>
      group.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedGroup) {
      return;
    }

    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: this.currentUser.empId || 'current',
      senderName: 'You',
      senderAvatar: this.currentUser.name?.charAt(0) || 'Y',
      message: this.newMessage.trim(),
      timestamp: new Date(),
      isCurrentUser: true
    };

    this.messages.push(message);
    this.newMessage = '';
    this.shouldScrollToBottom = true;

    // Update last message in group
    this.selectedGroup.lastMessage = message.message;
    this.selectedGroup.lastMessageTime = 'Just now';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.selectedGroup) {
      // Handle file upload
      const message: ChatMessage = {
        id: Date.now().toString(),
        senderId: this.currentUser.empId || 'current',
        senderName: 'You',
        senderAvatar: this.currentUser.name?.charAt(0) || 'Y',
        message: '',
        timestamp: new Date(),
        isCurrentUser: true,
        messageType: 'file',
        fileName: file.name,
        fileSize: this.formatFileSize(file.size),
        fileUrl: '#'
      };

      this.messages.push(message);
      this.shouldScrollToBottom = true;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatMessageTime(timestamp: Date): string {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      return messageDate.toLocaleDateString();
    }
  }

  createNewGroup() {
    // Implement create new group functionality
    console.log('Create new group clicked');
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  private startMessagePolling() {
    // Poll for new messages every 5 seconds
    this.messagePollingInterval = setInterval(() => {
      if (this.selectedGroup) {
        // In a real app, you'd check for new messages from the server
        // this.loadMessages(this.selectedGroup.id);
      }
    }, 5000);
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  toggleEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string) {
    this.newMessage += emoji;
    this.showEmojiPicker = false;
    this.messageInput.nativeElement.focus();
  }

  hasPinnedGroups(): boolean {
    return this.chatGroups.some(group => group.isPinned);
  }
}