export interface User {
  name: string;
}

export type RetroStatus = "brainstorm" | "group" | "vote" | "discuss";

export interface Retro {
  id: string;
  status: RetroStatus;
  title: string;
  columns: RetroColumn[];
  updated_at: string;
  created_at: string;
}

export interface RetroColumn {
  id: string;
  title: string;
  description: string;
}

export interface Note {
  id: string;
  created_by_me: boolean;
  column_id: string;
  group_id: string;
  content: string;
}

export interface Task {
  id: string;
  who: string;
  what: string;
  when: string;
}
