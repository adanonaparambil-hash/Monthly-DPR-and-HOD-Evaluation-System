import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo: string;
  dueDate: string;
  avatar: string;
  category: string;
  progress?: number;
}

interface Subtask {
  id: number;
  name: string;
  completed: boolean;
  estimatedHours: number;
  isRunning: boolean;
  timeSpent: number;
}

interface NewTask {
  name: string;
  description: string;
  assignee: string;
  type: 'single' | 'continuous';
  date: string;
  estimatedHours: number;
  subtasks: Subtask[];
}

interface Assignee {
  id: string;
  name: string;
  role: string;
}

@Component({
  selector: 'app-my-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-task.component.html',
  styleUrls: ['./my-task.component.css']
})
export class MyTaskComponent implements OnInit {
  currentTime = {
    hours: '01',
    minutes: '24',
    seconds: '15'
  };

  activeTab = 'All Tasks';
  tabs = ['All Tasks', 'HOD Assigned', 'Peer Assigned', 'Self Assigned'];

  // Modal state
  showCreateTaskModal = false;
  
  // New task form data
  newTask: NewTask = {
    name: '',
    description: '',
    assignee: '',
    type: 'single',
    date: '',
    estimatedHours: 0,
    subtasks: []
  };

  // Available assignees
  assignees: Assignee[] = [
    { id: 'me', name: 'Myself', role: 'Self' },
    { id: 'john', name: 'John Doe', role: 'Developer' },
    { id: 'sarah', name: 'Sarah Smith', role: 'Designer' },
    { id: 'alex', name: 'Alex Johnson', role: 'HOD' }
  ];

  // Timer state for new task
  taskTimer = {
    hours: 0,
    minutes: 0,
    seconds: 0,
    isRunning: false
  };

  tasks: Task[] = [
    {
      id: 1,
      title: 'Client Presentation prep',
      description: 'Prepare presentation materials for client meeting',
      status: 'NOT STARTED',
      priority: 'HIGH',
      assignedTo: 'John Doe',
      dueDate: 'Oct 25',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face&auto=format',
      category: 'MEETING'
    },
    {
      id: 2,
      title: 'Designing UI System v2.0',
      description: 'Update component library with fresh designs',
      status: 'IN PROGRESS',
      priority: 'MEDIUM',
      assignedTo: 'Jane Smith',
      dueDate: 'Oct 24',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face&auto=format',
      category: 'DESIGN SYSTEM',
      progress: 65
    },
    {
      id: 3,
      title: 'Sort creative assets',
      description: 'Organize and categorize design assets',
      status: 'NOT STARTED',
      priority: 'LOW',
      assignedTo: 'Mike Johnson',
      dueDate: 'Oct 25',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face&auto=format',
      category: 'ASSETS'
    },
    {
      id: 4,
      title: 'Copywriting for landing page',
      description: 'Write compelling copy for new landing page',
      status: 'IN PROGRESS',
      priority: 'MEDIUM',
      assignedTo: 'Sarah Wilson',
      dueDate: 'Paused',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face&auto=format',
      category: 'MARKETING'
    },
    {
      id: 5,
      title: 'Update Documentation',
      description: 'Update project documentation and API specs',
      status: 'NOT STARTED',
      priority: 'LOW',
      assignedTo: 'Alex Brown',
      dueDate: 'Oct 25',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face&auto=format',
      category: 'DOCS'
    }
  ];

  filteredTasks: Task[] = [];
  totalTasks = 12;
  notStartedCount = 3;
  inProgressCount = 2;
  completedCount = 7;

  totalPaidHours = '07:45';
  taskLoggedHours = '06:20';

  ngOnInit() {
    this.updateTimer();
    this.filterTasks();
    
    // Update timer every second
    setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  updateTimer() {
    const now = new Date();
    this.currentTime = {
      hours: now.getHours().toString().padStart(2, '0'),
      minutes: now.getMinutes().toString().padStart(2, '0'),
      seconds: now.getSeconds().toString().padStart(2, '0')
    };
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.filterTasks();
  }

  filterTasks() {
    // For now, show all tasks regardless of tab
    // In a real app, you'd filter based on assignment type
    this.filteredTasks = this.tasks;
  }

  getTasksByStatus(status: string): Task[] {
    return this.tasks.filter(task => task.status === status);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'NOT STARTED': return 'status-not-started';
      case 'IN PROGRESS': return 'status-in-progress';
      case 'COMPLETED': return 'status-completed';
      default: return '';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      case 'LOW': return 'priority-low';
      default: return '';
    }
  }

  // Modal methods
  openCreateTaskModal() {
    this.showCreateTaskModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeCreateTaskModal() {
    this.showCreateTaskModal = false;
    document.body.style.overflow = 'auto';
    this.resetForm();
  }

  resetForm() {
    this.newTask = {
      name: '',
      description: '',
      assignee: '',
      type: 'single',
      date: '',
      estimatedHours: 0,
      subtasks: []
    };
  }

  addSubtask() {
    const newSubtask: Subtask = {
      id: Date.now(),
      name: '',
      completed: false,
      estimatedHours: 0,
      isRunning: false,
      timeSpent: 0
    };
    this.newTask.subtasks.push(newSubtask);
  }

  removeSubtask(index: number) {
    this.newTask.subtasks.splice(index, 1);
  }

  startSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = true;
      // Stop other running subtasks
      this.newTask.subtasks.forEach(s => {
        if (s.id !== subtaskId) {
          s.isRunning = false;
        }
      });
    }
  }

  pauseSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = false;
    }
  }

  stopSubtaskTimer(subtaskId: number) {
    const subtask = this.newTask.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      subtask.isRunning = false;
      subtask.timeSpent = 0;
    }
  }

  saveAsDraft() {
    // Implement save as draft functionality
    console.log('Save as draft:', this.newTask);
  }

  createTask() {
    // Implement create task functionality
    console.log('Create task:', this.newTask);
    this.closeCreateTaskModal();
  }

  createNewTask() {
    // Implement create new task functionality
    console.log('Create new task clicked');
  }

  startNow() {
    this.openCreateTaskModal();
  }

  stopTimer() {
    // Implement stop timer functionality
    console.log('Stop timer clicked');
  }
}