// ProofHub Task Explorer — models
// Used by the Task Explorer modal inside Log Analytics

export interface ServiceResponse<T> {
  Success: boolean;
  Message: string;
  Data: T;
}

// masters
export interface ProjectItem  { PROJECT_ID: number; TITLE: string; }
export interface TodolistItem { TODOLIST_ID: number; PROJECT_ID: number; TITLE: string; }
export interface CreatorItem  { USER_ID: number; NAME: string; EMAIL: string; }
export interface MastersDto   { Projects: ProjectItem[]; Todolists: TodolistItem[]; Creators: CreatorItem[]; }

// listing
export interface TaskSearchRequest {
  title?: string;
  projectId?: number;
  listId?: number;
  createdBy?: number;
  dateFrom?: string;   // 'yyyy-MM-dd'
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface TaskListItem {
  TASK_ID: string; TITLE: string;
  PROJECT_ID?: number; PROJECT_NAME?: string;
  LIST_ID?: number; LIST_NAME?: string;
  CREATOR_ID?: number; CREATED_BY?: string;
  CREATED_AT?: string; START_DATE?: string; DUE_DATE?: string;
  COMPLETED?: string; PERCENT_PROGRESS?: number;
  ASSIGNEES?: string;
  COMMENT_COUNT: number; FILE_COUNT: number; SUBTASK_COUNT: number;
}

export interface TaskSearchResult {
  Total: number; Page: number; PageSize: number; Items: TaskListItem[];
}

// detail
export interface TaskHeader {
  TASK_ID: string; TITLE: string; DESCRIPTION?: string;
  START_DATE?: string; DUE_DATE?: string; COMPLETED?: string; PERCENT_PROGRESS?: number;
  ESTIMATED_HOURS?: number; LOGGED_HOURS?: number; CREATED_AT?: string; PARENT_ID?: number;
  PROJECT_ID?: number; PROJECT_NAME?: string; LIST_ID?: number; LIST_NAME?: string;
  CREATOR_ID?: number; CREATED_BY?: string;
}

export interface SubtaskItem {
  TASK_ID: string; TITLE: string; COMPLETED?: string; PERCENT_PROGRESS?: number;
  DUE_DATE?: string; ASSIGNEES?: string; COMMENT_COUNT: number; FILE_COUNT: number;
}

export interface AssigneeItem { USER_ID: number; NAME: string; EMAIL: string; }

export interface CommentItem {
  COMMENT_ID: number; DESCRIPTION?: string; MENTIONED_IDS?: string; CREATED_AT?: string;
  CREATOR_ID?: number; AUTHOR_NAME?: string; AUTHOR_EMAIL?: string;
}

export interface FileItem {
  FILE_ID: number; FILE_NAME: string; FILE_TYPE?: string; BYTE_SIZE?: number;
  SOURCE_TYPE?: string; DRIVE_FILE_ID?: string; DRIVE_URL?: string;
  PREVIEW_URL?: string; DOWNLOAD_URL?: string;
}

export interface TaskDetailDto {
  Task: TaskHeader; Subtasks: SubtaskItem[]; Assignees: AssigneeItem[];
  Comments: CommentItem[]; Files: FileItem[];
}
