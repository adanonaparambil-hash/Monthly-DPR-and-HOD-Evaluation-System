// Demo data for chat module - replace with real API calls

export const DEMO_CHAT_GROUPS = [
  {
    id: '1',
    name: 'Engineering Team',
    avatar: 'ET',
    lastMessage: 'Hey team, has anyone reviewed the new dashboard components? I think the analytics chart needs a height adjustment.',
    lastMessageTime: '10:42 AM',
    unreadCount: 0,
    isOnline: true,
    memberCount: 12,
    isPinned: true,
    members: [
      { id: '1', name: 'Mike Thompson', avatar: 'MT', isOnline: true, role: 'Senior Developer' },
      { id: '2', name: 'Redha Ali', avatar: 'RA', isOnline: true, role: 'Full Stack Developer' },
      { id: '3', name: 'Sarah Connor', avatar: 'SC', isOnline: false, role: 'Project Manager' },
      { id: '4', name: 'John Smith', avatar: 'JS', isOnline: true, role: 'UI/UX Designer' },
      { id: '5', name: 'Emma Wilson', avatar: 'EW', isOnline: false, role: 'QA Engineer' }
    ]
  },
  {
    id: '2',
    name: 'HR Updates',
    avatar: 'HR',
    lastMessage: 'New policy regarding annual leave applications has been updated. Please review the changes in the employee handbook.',
    lastMessageTime: 'Yesterday',
    unreadCount: 2,
    isOnline: false,
    memberCount: 45,
    isPinned: false
  },
  {
    id: '3',
    name: 'Sarah Connor',
    avatar: 'SC',
    lastMessage: 'Can you approve the budget for the new project? I\'ve sent the details via email.',
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
    lastMessage: 'Meeting rescheduled to 4 PM today. Please update your calendars accordingly.',
    lastMessageTime: 'Mon',
    unreadCount: 0,
    isOnline: false,
    memberCount: 8,
    isPinned: false
  },
  {
    id: '5',
    name: 'Design Team',
    avatar: 'DT',
    lastMessage: 'The new mockups are ready for review. Check the Figma link I shared.',
    lastMessageTime: 'Sun',
    unreadCount: 3,
    isOnline: true,
    memberCount: 6,
    isPinned: false
  }
];

export const DEMO_MESSAGES = {
  '1': [
    {
      id: '1',
      groupId: '1',
      senderId: 'mike123',
      senderName: 'Mike Thompson',
      senderAvatar: 'MT',
      message: 'Hey team, has anyone reviewed the new dashboard components? I think the analytics chart needs a height adjustment.',
      timestamp: new Date('2024-01-01T10:42:00'),
      messageType: 'text' as const,
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
      messageType: 'text' as const,
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
      messageType: 'file' as const,
      fileName: 'error_log_staging.pdf',
      fileSize: '2.4 MB',
      fileUrl: '#',
      isRead: true
    },
    {
      id: '4',
      groupId: '1',
      senderId: 'current',
      senderName: 'You',
      senderAvatar: 'Y',
      message: 'Thanks @Redha Ali ! I\'ll hold off on the merge until you verify the fix. Let me know.',
      timestamp: new Date('2024-01-01T10:47:00'),
      messageType: 'text' as const,
      isRead: false
    }
  ],
  '2': [
    {
      id: '5',
      groupId: '2',
      senderId: 'hr001',
      senderName: 'HR Team',
      senderAvatar: 'HR',
      message: 'New policy regarding annual leave applications has been updated. Please review the changes in the employee handbook.',
      timestamp: new Date('2024-01-01T09:30:00'),
      messageType: 'text' as const,
      isRead: false
    },
    {
      id: '6',
      groupId: '2',
      senderId: 'hr001',
      senderName: 'HR Team',
      senderAvatar: 'HR',
      message: 'The updated handbook is available in the company portal under Documents > Policies.',
      timestamp: new Date('2024-01-01T09:32:00'),
      messageType: 'text' as const,
      isRead: false
    }
  ]
};