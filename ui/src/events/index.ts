import { RetroStatus } from "@/types";

export type Payload = object;

export interface SocketEvent {
  name: string;
  payload: Payload;
}

export interface PayloadRetroUpdate {
  title: string;
  unlisted: boolean;
  max_votes: number;
  tags: string[];
}

export interface PayloadStatusUpdate {
  status: RetroStatus;
}

export interface PayloadError {
  message: string;
  ref?: string;
}

export type PayloadStatusUpdated = PayloadStatusUpdate;

export interface PayloadNoteCreate {
  column_id: string;
  content: string;
  // Added to the local dispatch only, never sent: without it the author line
  // pops in when the server echo lands.
  created_by_name?: string;
}

export interface PayloadNoteUpdate {
  id: string;
  content?: string;
  column_id?: string;
  group_id?: string;
  img_url?: string;
  remove_img_url?: boolean;
}

export interface Ref {
  ref: string;
}

export interface PayloadColumnCreate {
  title: string;
  description: string;
}

export interface PayloadColumnUpdate extends PayloadColumnCreate {
  id: string;
}

export interface PayloadColumnDelete {
  id: string;
}

export interface PayloadConnectionInfo {
  users: string[];
}

export function createSocketEvent(
  name: string,
  payload: object = {},
): SocketEvent {
  return { name, payload };
}
