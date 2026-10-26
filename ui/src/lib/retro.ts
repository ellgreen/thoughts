import { queryOptions } from "@tanstack/react-query";
import { api } from "./api";

export type Stage = "reflect" | "group" | "vote" | "discuss";
export const stages: { id: Stage; label: string; next: string }[] = [
  { id: "reflect", label: "Reflect", next: "Start reflecting" },
  { id: "group", label: "Group", next: "Reveal and group" },
  { id: "vote", label: "Vote", next: "Open voting" },
  { id: "discuss", label: "Discuss", next: "Start discussing" },
];

export type Column = { id: string; title: string; description: string };

export type Retro = {
  id: string;
  title: string;
  stage: Stage;
  maxVotes: number;
  unlisted: boolean;
  tags: string[];
  columns: Column[];
  recap: string;
  teamId: string;
  createdAt: string;
};

export type RetroSummary = Retro & { notes: number; actions: number; actionsDone: number };

export type Reaction = { emoji: string; count: number; mine: boolean };

export type Note = {
  id: string;
  mine: boolean;
  hidden: boolean;
  size?: number;
  content?: string;
  imgUrl?: string;
  author?: { id: string; name: string };
  reactions: Reaction[];
};

export type Group = {
  id: string;
  columnId: string;
  title: string;
  notes: Note[];
  myVotes: number;
  votes?: number;
};

export type Action = { id: string; what: string; who: string; dueOn: string; done: boolean; carriedFrom?: string };

const dueFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
export function formatDueOn(date: string) {
  return dueFormat.format(new Date(`${date}T12:00:00`));
}

export type Suggestion =
  | { id: string; kind: "groups"; items: { title: string; noteIds: string[] }[] }
  | { id: string; kind: "names"; items: { groupId: string; title: string }[] }
  | { id: string; kind: "actions"; items: { what: string; groupId: string }[] };

export type Board = {
  version: number;
  retro: Retro;
  groups: Group[];
  votes: { used: number; max: number };
  actions: Action[];
  suggestions: Suggestion[];
  serverNow: string;
  // clockOffset is the server's clock minus this browser's, measured when
  // the board arrived.
  clockOffset?: number;
  timer: { endsAt?: string; left?: number };
  ready: string[];
  spotlight: string;
  team: Team | null;
  lastTime: OpenAction[];
};

export type Team = { id: string; slug: string; name: string };
export type TeamSummary = Team & { retros: number; openActions: number };

export const teamsQuery = queryOptions({
  queryKey: ["teams"],
  queryFn: () => api<{ teams: TeamSummary[] }>("/api/teams").then((r) => r.teams),
});

export const teamQuery = (slug: string) =>
  queryOptions({
    queryKey: ["team", slug],
    queryFn: () => api<{ team: Team; retros: RetroSummary[]; openActions: OpenAction[] }>(`/api/teams/${encodeURIComponent(slug)}`),
  });

export const createTeam = (name: string, fromTag?: string) => api<Team>("/api/teams", { method: "POST", body: { name, fromTag } });

export type Person = { id: string; name: string };

export const reactions = ["👍", "🎉", "😂", "😮", "👀", "❤️"];

export const retrosQuery = queryOptions({
  queryKey: ["retros"],
  queryFn: () => api<{ retros: RetroSummary[] }>("/api/retros").then((r) => r.retros),
});

export const tagsQuery = queryOptions({
  queryKey: ["tags"],
  queryFn: () => api<{ tags: string[] }>("/api/tags").then((r) => r.tags),
  staleTime: 60_000,
});

export type OpenAction = Action & { retroId: string; retroTitle: string };

export const tagQuery = (tag: string) =>
  queryOptions({
    queryKey: ["tag", tag],
    queryFn: () =>
      api<{ tag: string; retros: RetroSummary[]; openActions: OpenAction[] }>(`/api/tags/${encodeURIComponent(tag)}`),
  });

export const retroQuery = (id: string) =>
  queryOptions({
    queryKey: ["retro", id],
    queryFn: () => api<Retro>(`/api/retros/${encodeURIComponent(id)}`),
  });

export type NewRetro = {
  title: string;
  columns: { title: string; description: string }[];
  tags: string[];
  unlisted: boolean;
  teamId?: string;
};

export const createRetro = (r: NewRetro) => api<Retro>("/api/retros", { method: "POST", body: r });

export const themedTemplate = (theme: string) =>
  api<{ theme: string; columns: { title: string; description: string }[] }>("/api/ai/template", { method: "POST", body: { theme } });

export function cleanTag(t: string) {
  return t.toLowerCase().trim().split(/\s+/).filter(Boolean).join("-");
}

export type Template = { name: string; columns: { title: string; description: string }[] };

export const templates: Template[] = [
  {
    name: "Went well, puzzled us, try next",
    columns: [
      { title: "Went well", description: "What should we keep doing?" },
      { title: "Puzzled us", description: "What didn't make sense?" },
      { title: "Try next", description: "One thing to change next time" },
    ],
  },
  {
    name: "Mad, sad, glad",
    columns: [
      { title: "Mad", description: "What made you mad?" },
      { title: "Sad", description: "What made you sad?" },
      { title: "Glad", description: "What made you glad?" },
    ],
  },
  {
    name: "Start, stop, continue",
    columns: [
      { title: "Start", description: "What should we start doing?" },
      { title: "Stop", description: "What should we stop doing?" },
      { title: "Continue", description: "What should we keep doing?" },
    ],
  },
  {
    name: "4Ls",
    columns: [
      { title: "Liked", description: "What did you like?" },
      { title: "Learned", description: "What did you learn?" },
      { title: "Lacked", description: "What was missing?" },
      { title: "Longed for", description: "What did you wish for?" },
    ],
  },
  {
    name: "Weather report",
    columns: [
      { title: "Sunny", description: "What went well and felt good?" },
      { title: "Cloudy", description: "What felt uncertain or unclear?" },
      { title: "Stormy", description: "What was hard or frustrating?" },
    ],
  },
  {
    name: "Hot air balloon",
    columns: [
      { title: "Hot air", description: "What lifted us?" },
      { title: "Sandbags", description: "What weighed us down?" },
      { title: "Sky", description: "Where are we trying to get to?" },
    ],
  },
  {
    name: "Garden",
    columns: [
      { title: "Seeds", description: "What should we plant?" },
      { title: "Weeds", description: "What should we pull out?" },
      { title: "Blooms", description: "What's growing well?" },
    ],
  },
  {
    name: "Treasure map",
    columns: [
      { title: "Treasure", description: "What did we find?" },
      { title: "Rocks", description: "What got in the way?" },
      { title: "Map", description: "What do we plan for next?" },
    ],
  },
  {
    name: "Mountain climb",
    columns: [
      { title: "Summit", description: "What was the high point?" },
      { title: "Cliffs", description: "What made the climb hard?" },
      { title: "Trail", description: "What kept us moving?" },
    ],
  },
  {
    name: "Plus, delta",
    columns: [
      { title: "Plus", description: "What went well?" },
      { title: "Delta", description: "What would we change?" },
    ],
  },
];
