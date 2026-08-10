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
  /** Echoed back from the failed request so the client can roll back the one
   * optimistic update that failed rather than every in-flight one. */
  ref?: string;
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
  img_url?: string;
  remove_img_url?: boolean;
}

/** Correlation id attached to optimistic mutations and echoed back by the
 * server on both confirmation and failure. */
export interface Ref {
  ref: string;
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
