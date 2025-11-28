export interface User {
  name: string;
  ai_enabled: boolean;
}

export type RetroStatus = "brainstorm" | "group" | "vote" | "discuss";

export interface Retro {
  id: string;
  status: RetroStatus;
  title: string;
  columns: RetroColumn[];
  unlisted: boolean;
  max_votes: number;
  gifs_enabled: boolean;
  created_at: string;
  note_count: number;
  task_count: number;
  task_completed_count: number;
}

export interface RetroColumn {
  id: string;
  title: string;
  description: string;
}

export interface Note {
  id: string;
  created_by_me: boolean;
  created_by_name?: string;
  column_id: string;
  group_id: string;
  content: string;
  img_url: string;
}

export interface Task {
  id: string;
  who: string;
  what: string;
  when: string;
  completed: boolean;
}

export interface AIRetroTemplateResponse {
  theme: string;
  columns: {
    title: string;
    description: string;
  }[];
}
