import type { Score, Submission } from "./types";

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function hasApi(): boolean {
  return !!BASE;
}

export type Role = "jury" | "organizer";
export type Me = { authenticated: boolean; id?: number; role?: Role; displayName?: string };
export type Account = { id: number; username: string; role: Role; display_name: string | null; created_at: string };
export type ResultRow = { id: string; posterNo: number; title: string; author?: string; group?: string; status: string; juryCount: number; total: number };

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error((data && data.error) || `request_failed_${res.status}`);
  return data as T;
}

// The API returns database rows (snake_case, e.g. poster_no, image_key) but
// the rest of the app works with the camelCase Submission type. This maps
// one to the other in one place, so it works the same whether the row came
// from the VPS backend (server/, SQLite, image_key = "posters/<id>") or the
// Vercel backend (api/, Postgres, image_key = a full Vercel Blob URL).
function normalizeSubmission(row: any): Submission {
  const imageKey = row.image_key ?? row.imageUrl ?? "";
  const imageUrl = imageKey ? (/^https?:\/\//.test(imageKey) ? imageKey : `${BASE}/api/${imageKey.replace(/^\/?/, "")}`) : undefined;
  return {
    id: row.id,
    posterNo: row.poster_no ?? row.posterNo,
    title: row.title,
    idea: row.idea,
    problem: row.problem ?? "",
    author: row.author ?? "",
    group: row.group_name ?? row.group ?? "",
    contact: row.contact ?? "",
    tools: row.tools ?? "",
    aiHow: row.ai_how ?? row.aiHow,
    contribution: row.contribution ?? "",
    interactive: !!row.interactive,
    interactiveUrl: row.interactive_url ?? row.interactiveUrl ?? "",
    imageUrl,
    status: row.status,
    createdAt: row.created_at ?? row.createdAt,
    audience: row.audience_count ?? row.audience ?? 0,
  };
}

export const api = {
  me: () => request<Me>("/api/me"),
  login: (username: string, password: string) => request<Me & { username: string }>("/api/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: true }>("/api/logout", { method: "POST" }),

  submissions: () => request<{ submissions: any[] }>("/api/submissions").then((r) => r.submissions.map(normalizeSubmission)),
  submission: (id: string) => request<any>("/api/submissions/" + id).then(normalizeSubmission),
  // Admin moderation screen only: every status, every column (incl. author).
  // Any other call — including the organizer just browsing the public
  // gallery/poster pages while logged in — must stay on the plain variants
  // above, so names stay hidden there until she explicitly reveals them.
  adminSubmissions: () => request<{ submissions: any[] }>("/api/submissions?view=admin").then((r) => r.submissions.map(normalizeSubmission)),
  createSubmission: (data: Record<string, unknown>) => request<{ id: string; posterNo: number; status: string }>("/api/submissions", { method: "POST", body: JSON.stringify(data) }),

  uploadImage: async (id: string, file: File) => {
    const res = await fetch(BASE + "/api/upload/" + id, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("upload_failed");
    return res.json();
  },

  setStatus: (id: string, status: Submission["status"]) => request<{ ok: true }>("/api/submissions/" + id + "/status", { method: "PATCH", body: JSON.stringify({ status }) }),
  score: (id: string, score: Score) => request<{ ok: true; total: number }>("/api/submissions/" + id + "/score", { method: "PUT", body: JSON.stringify(score) }),
  reaction: (id: string) => request<{ ok: true; audience: number }>("/api/submissions/" + id + "/reaction", { method: "POST" }),
  results: () => request<{ results: ResultRow[]; namesRevealed: boolean }>("/api/results"),

  listAccounts: () => request<{ users: Account[] }>("/api/admin/users").then((r) => r.users),
  createAccount: (username: string, password: string, role: Role) => request<{ ok: true }>("/api/admin/users", { method: "POST", body: JSON.stringify({ username, password, role }) }),

  // Whether the organizer has revealed author names publicly. GET works for
  // anyone (jury/gallery visitors need to know); only the organizer can PATCH it.
  getSettings: () => request<{ namesRevealed: boolean }>("/api/settings"),
  setNamesRevealed: (namesRevealed: boolean) => request<{ ok: true; namesRevealed: boolean }>("/api/settings", { method: "PATCH", body: JSON.stringify({ namesRevealed }) }),
};
