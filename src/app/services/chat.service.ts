import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { Api } from './api';

export interface ChatGroup {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
  memberCount?: number;
  isPinned?: boolean;
  members?: ChatMember[];
}

export interface ChatMember {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  role?: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  timestamp: Date;
  messageType?: 'text' | 'file' | 'image';
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  isRead?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private chatGroupsSubject = new BehaviorSubject<ChatGroup[]>([]);
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private selectedGroupSubject = new BehaviorSubject<ChatGroup | null>(null);

  public chatGroups$ = this.chatGroupsSubject.asObservable();
  public messages$ = this.messagesSubject.asObservable();
  public selectedGroup$ = this.selectedGroupSubject.asObservable();

  constructor(private api: Api) {}

  // Get all chat groups for the current user
  getChatGroups(): Observable<ChatGroup[]> {
    // In a real implementation, this would call your API
    // return this.api.getChatGroups();
    
    // Mock data for now
    const mockGroups: ChatGroup[] = [
      {
        id: '1',
        name: 'Engineering Team',
        avatar: 'assets/images/team-engineering.png',
        lastMessage: 'Hey team, has anyone reviewed the new dashboard components?',
        lastMessageTime: '10:42 AM',
        unreadCount: 0,
        isOnline: true,
        memberCount: 12,
        isPinned: true,
        members: [
          { id: '1', name: 'Mike Thompson', avatar: 'MT', isOnline: true, role: 'Developer' },
          { id: '2', name: 'Redha Ali', avatar: 'RA', isOnline: true, role: 'Developer' },
          { id: '3', name: 'Sarah Connor', avatar: 'SC', isOnline: false, role: 'Manager' }
        ]
      },
      {
        id: '2',
        name: 'HR Updates',
        avatar: 'HR',
        lastMessage: 'New policy regarding annual leave...',
        lastMessageTime: 'Yesterday',
        unreadCount: 2,
        isOnline: false,
        memberCount: 0,
        isPinned: false
      },
      {
        id: '3',
        name: 'Sarah Connor',
        avatar: 'SC',
        lastMessage: 'Can you approve the budget?',
        lastMessageTime: 'Tue',
        unreadCount: 1,
        isOnline: false,
        memberCount: 0,
        isPinned: false
      },
      {
        id: '4',
        name: 'Project Alpha',
        avatar: 'PA',
        lastMessage: 'Meeting rescheduled to 4 PM',
        lastMessageTime: 'Mon',
        unreadCount: 0,
        isOnline: false,
        memberCount: 0,
        isPinned: false
      }
    ];

    this.chatGroupsSubject.next(mockGroups);
    return of(mockGroups);
  }

  // Get messages for a specific group
  getMessages(groupId: string): Observable<ChatMessage[]> {
    // In a real implementation, this would call your API
    // return this.api.getChatMessages(groupId);
    
    // Mock messages for Engineering Team
    const mockMessages: ChatMessage[] = groupId === '1' ? [
      {
        id: '1',
        groupId: '1',
        senderId: 'mike123',
        senderName: 'Mike Thompson',
        senderAvatar: 'MT',
        message: 'Hey team, has anyone reviewed the new dashboard components? I think the analytics chart needs a height adjustment.',
        timestamp: new Date('2024-01-01T10:42:00'),
        messageType: 'text',
        isRead: true
      },
      {
        id: '2',
        groupId: '1',
        senderId: 'redha456',
        senderName: 'Redha Ali',
        senderAvatar: 'RA',
        message: 'The build is failing on staging because of that missing dependency. I\'ll push a fix in 5 mins.',
        timestamp: new Date('2024-01-01T10:45:00'),
        messageType: 'text',
        isRead: true
      },
      {
        id: '3',
        groupId: '1',
        senderId: 'redha456',
        senderName: 'Redha Ali',
        senderAvatar: 'RA',
        message: '',
        timestamp: new Date('2024-01-01T10:46:00'),
        messageType: 'file',
        fileName: 'error_log_staging.pdf',
        fileSize: '2.4 MB',
        fileUrl: '#',
        isRead: true
      }
    ] : [];

    this.messagesSubject.next(mockMessages);
    return of(mockMessages);
  }

  // Send a new message
  sendMessage(groupId: string, message: string, messageType: 'text' | 'file' | 'image' = 'text', fileData?: any): Observable<ChatMessage> {
    // In a real implementation, this would call your API
    // return this.api.sendChatMessage(groupId, message, messageType, fileData);
    
    const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      groupId: groupId,
      senderId: currentUser.empId || 'current',
      senderName: currentUser.employeeName || 'You',
      senderAvatar: currentUser.name?.charAt(0) || 'Y',
      message: message,
      timestamp: new Date(),
      messageType: messageType,
      isRead: false,
      ...fileData
    };

    // Add to current messages
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, newMessage]);

    // Update last message in group
    const currentGroups = this.chatGroupsSubject.value;
    const updatedGroups = currentGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          lastMessage: messageType === 'text' ? message : `📎 ${fileData?.fileName || 'File'}`,
          lastMessageTime: 'Just now'
        };
      }
      return group;
    });
    this.chatGroupsSubject.next(updatedGroups);

    return of(newMessage);
  }

  // Create a new chat group
  createChatGroup(name: string, members: string[]): Observable<ChatGroup> {
    // In a real implementation, this would call your API
    // return this.api.createChatGroup(name, members);
    
    const newGroup: ChatGroup = {
      id: Date.now().toString(),
      name: name,
      avatar: name.charAt(0),
      lastMessage: 'Group created',
      lastMessageTime: 'Just now',
      unreadCount: 0,
      isOnline: false,
      memberCount: members.length,
      isPinned: false
    };

    const currentGroups = this.chatGroupsSubject.value;
    this.chatGroupsSubject.next([newGroup, ...currentGroups]);

    return of(newGroup);
  }

  // Mark messages as read
  markMessagesAsRead(groupId: string): Observable<boolean> {
    // In a real implementation, this would call your API
    // return this.api.markChatMessagesAsRead(groupId);
    
    const currentMessages = this.messagesSubject.value;
    const updatedMessages = currentMessages.map(message => {
      if (message.groupId === groupId) {
        return { ...message, isRead: true };
      }
      return message;
    });
    this.messagesSubject.next(updatedMessages);

    // Update unread count in group
    const currentGroups = this.chatGroupsSubject.value;
    const updatedGroups = currentGroups.map(group => {
      if (group.id === groupId) {
        return { ...group, unreadCount: 0 };
      }
      return group;
    });
    this.chatGroupsSubject.next(updatedGroups);

    return of(true);
  }

  // Get unread message count
  getUnreadCount(): Observable<number> {
    const currentGroups = this.chatGroupsSubject.value;
    const totalUnread = currentGroups.reduce((total, group) => total + (group.unreadCount || 0), 0);
    return of(totalUnread);
  }

  // Search chat groups
  searchGroups(query: string): Observable<ChatGroup[]> {
    const currentGroups = this.chatGroupsSubject.value;
    const filteredGroups = currentGroups.filter(group =>
      group.name.toLowerCase().includes(query.toLowerCase())
    );
    return of(filteredGroups);
  }

  // Set selected group
  setSelectedGroup(group: ChatGroup | null) {
    this.selectedGroupSubject.next(group);
  }

  // Get selected group
  getSelectedGroup(): ChatGroup | null {
    return this.selectedGroupSubject.value;
  }

  // Upload file (placeholder)
  uploadFile(file: File): Observable<{ url: string; fileName: string; fileSize: string }> {
    // In a real implementation, this would upload the file to your server
    // return this.api.uploadChatFile(file);
    
    // Mock response
    return of({
      url: '#',
      fileName: file.name,
      fileSize: this.formatFileSize(file.size)
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}