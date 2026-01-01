# Chat Module

This module provides internal communications functionality for the MPR Portal application.

## Features

- **Real-time messaging**: Send and receive messages in group chats
- **File sharing**: Upload and share files with team members
- **Group management**: Create and manage chat groups
- **Online status**: See who's online and available
- **Message search**: Search through chat groups
- **Pinned conversations**: Pin important conversations for quick access
- **Unread indicators**: Visual indicators for unread messages
- **Responsive design**: Works on desktop and mobile devices

## Components

### ChatComponent
Main chat interface component that handles:
- Chat group listing
- Message display and sending
- File uploads
- User interactions

### ChatService
Service that manages:
- Chat data fetching
- Message sending
- Group management
- Real-time updates

## Usage

The chat module is accessible via the sidebar navigation menu. Users can:

1. **View chat groups**: See all available chat groups in the sidebar
2. **Select conversations**: Click on a group to view messages
3. **Send messages**: Type and send text messages
4. **Share files**: Upload and share files with the team
5. **Create groups**: Start new group conversations

## API Integration

The chat service is designed to integrate with your backend API. Currently using mock data for demonstration. To integrate with real API:

1. Update `ChatService` methods to call actual API endpoints
2. Implement real-time updates using WebSockets or Server-Sent Events
3. Add authentication headers to API calls
4. Handle error states and loading indicators

## Styling

The chat module uses a modern, clean design that matches the existing application theme:
- Consistent color scheme with the main application
- Responsive layout for mobile devices
- Smooth animations and transitions
- Accessible design patterns

## Future Enhancements

- Voice and video calling
- Message reactions and emojis
- Message threading
- Advanced file preview
- Message encryption
- Push notifications
- Message scheduling