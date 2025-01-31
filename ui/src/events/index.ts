import { RetroStatus } from "@/types";

export type Payload = object;

export interface SocketEvent {
  name: string;
  payload: Payload;
}

export interface PayloadRetroUpdate {
  title: string;
  unlisted: boolean;
}

export interface PayloadStatusUpdate {
  status: RetroStatus;
}

export interface PayloadError {
  message: string;
}

export type PayloadStatusUpdated = PayloadStatusUpdate;

export interface PayloadNoteCreate {
  column_id: string;
  content: string;
}

export interface PayloadNoteUpdate {
  id: string;
  content?: string;
  column_id?: string;
  group_id?: string;
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
