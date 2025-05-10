export interface User {
  name: string;
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
