import { TaskStatus, TaskPriority } from "@prisma/client";

export interface TaskUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface TaskLabelItem {
  id: string;
  labelId: string;
  taskId: string;
  label: {
    id: string;
    name: string;
    color: string;
    description?: string | null;
  };
}

export interface TaskItem {
  id: string;
  taskKey?: string | null;
  taskNumber: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex: number;
  dueDate?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  projectId: string;
  assigneeId?: string | null;
  creatorId: string;
  assignee?: TaskUser | null;
  creator?: TaskUser | null;
  labels?: TaskLabelItem[];
  _count?: {
    comments: number;
    subTasks: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface LabelOption {
  id: string;
  name: string;
  color: string;
  description?: string | null;
}
