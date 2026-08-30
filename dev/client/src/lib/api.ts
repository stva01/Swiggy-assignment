/* Logic layer API boundary: the browser never talks to Groq directly; FastAPI owns provider credentials and orchestration. */
export type MessageTone = "Friendly" | "Formal" | "Urgent";

export type GenerateMessageRequest = {
  candidateId: string;
  candidateName: string;
  joiningDate: string;
  daysToJoin: number;
  risk: string;
  nextAction: string;
  channel: string;
  tone: MessageTone;
  role?: string;
  location?: string;
  interactions?: Array<{ channel: string; direction: "in" | "out"; timestamp: string; text: string }>;
};

export type CandidateAIContext = Omit<GenerateMessageRequest, "channel" | "tone">;

export type CandidateAnalysisResponse = {
  summary: string;
  risk: "low" | "medium" | "high";
  evidence: Array<{ category: string; quote: string; severity: "low" | "medium" | "high" }>;
  recommended_action: string;
  confidence: number;
  limitations: string[];
  model: string;
  requestId: string;
};

export type PersistedInteraction = { id: string; channel: string; direction: "in" | "out"; timestamp: string; text: string; tone: string };
export type CandidateState = { candidateId: string; risk: "low" | "medium" | "high"; aiRisk: "low" | "medium" | "high"; overrideReason: string | null; steps: Record<string, "completed" | "pending" | "overdue">; interactions: PersistedInteraction[] };
export type CandidateBootstrap = { candidateId: string; name: string; email: string; role: string; department: string; location: string; recruiter: string; offerDate: string; joiningDate: string; risk: "low" | "medium" | "high"; aiRisk: "low" | "medium" | "high"; steps: Array<{ key: string; label: string; status: "completed" | "pending" | "overdue" }>; interactions: Array<{ channel: string; direction: "in" | "out"; text: string; tone?: string }> };
export type DashboardCandidate = { id: string; name: string; initials: string; role: string; department: string; location: string; recruiter: string; recruiterInitials: string; offerDate: string; joiningDate: string; joiningDayLabel: string; daysToJoin: number; risk: "low" | "medium" | "high"; aiRisk: "low" | "medium" | "high"; engagement: "on track" | "needs attention" | "at risk"; lastContactDays: number; nextAction: string; email: string; steps: Array<{ key: string; label: string; shortLabel: string; due: string; status: "completed" | "pending" | "overdue" }> };
export type CandidatePage = { items: DashboardCandidate[]; total: number; page: number; pageSize: number; totalPages: number };

export type GenerateMessageResponse = {
  draft: string;
  model?: string;
  requestId?: string;
};

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname.includes("onrender.com")
    ? "https://post-offer-backend.onrender.com"
    : "")
).replace(/\/$/, "");

export async function requestGeneratedMessage(payload: GenerateMessageRequest): Promise<GenerateMessageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai/messages/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`AI generation failed with ${response.status}`);
  return response.json() as Promise<GenerateMessageResponse>;
}

export async function requestCandidateAnalysis(payload: CandidateAIContext): Promise<CandidateAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/ai/candidates/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`AI analysis failed with ${response.status}`);
  return response.json() as Promise<CandidateAnalysisResponse>;
}

async function persistedRequest<T>(path: string, method: "POST" | "PUT" | "PATCH", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Persistence request failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export function bootstrapCandidate(payload: CandidateBootstrap) { return persistedRequest<CandidateState>(`/api/v1/candidates/${encodeURIComponent(payload.candidateId)}/bootstrap`, "PUT", payload); }
export function createManualInteraction(candidateId: string, payload: { channel: string; text: string; tone?: string }) { return persistedRequest<PersistedInteraction>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/interactions`, "POST", payload); }
export function updateJourneyStep(candidateId: string, stepKey: string, status: "completed" | "pending" | "overdue") { return persistedRequest<CandidateState>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/journey-steps/${encodeURIComponent(stepKey)}`, "PATCH", { status }); }
export function createRiskOverride(candidateId: string, risk: "low" | "medium" | "high", reason: string, overriddenBy: string) { return persistedRequest<CandidateState>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/risk-overrides`, "POST", { risk, reason, overriddenBy }); }
export function fetchCandidateState(candidateId: string) { return fetch(`${API_BASE_URL}/api/v1/candidates/${encodeURIComponent(candidateId)}/state`).then(async (response) => { if (!response.ok) throw new Error(`Candidate state failed with ${response.status}`); return response.json() as Promise<CandidateState>; }); }
export function fetchCandidateDetail(candidateId: string) { return fetch(`${API_BASE_URL}/api/v1/candidates/${encodeURIComponent(candidateId)}`).then(async (response) => { if (!response.ok) throw new Error(`Candidate detail failed with ${response.status}`); return response.json() as Promise<DashboardCandidate>; }); }

export async function fetchCandidates(params: { search?: string; risk?: string; recruiter?: string; month?: string; page: number; pageSize: number; sort: "joining" | "risk" }): Promise<CandidatePage> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize), sort: params.sort });
  if (params.search) query.set("search", params.search);
  if (params.risk && params.risk !== "all") query.set("risk", params.risk);
  if (params.recruiter && params.recruiter !== "all") query.set("recruiter", params.recruiter);
  if (params.month && params.month !== "all") query.set("month", params.month === "Aug" ? "8" : "9");
  const response = await fetch(`${API_BASE_URL}/api/v1/candidates?${query}`);
  if (!response.ok) throw new Error(`Candidate list failed with ${response.status}`);
  return response.json() as Promise<CandidatePage>;
}

export type Task = {
  id: string;
  candidateId: string;
  candidate: string;
  candidateInitials?: string;
  role?: string;
  location?: string;
  dueLabel: string;
  dueGroup: "Overdue" | "Today" | "Upcoming";
  action: string;
  source: "system" | "AI" | "human" | "automation";
  accent: "orange" | "tomato" | "sage";
  status?: "open" | "completed" | "dismissed";
  assignedTo?: string | null;
  suggestedMessage?: string | null;
  ruleName?: string | null;
  createdAt?: string;
};

export type FlaggedCandidateDetail = {
  candidateId: string;
  candidateName: string;
  role?: string;
  recruiter?: string;
  daysToJoin: number;
  lastContactDays: number;
  previousRisk: string;
  currentRisk: string;
  flagApplied: boolean;
  draftMessage: string;
  taskCreated: boolean;
  existingTask: boolean;
};

export type EvaluateRulesResponse = {
  ruleName: string;
  evaluatedCandidatesCount: number;
  flaggedCount: number;
  tasksCreatedCount: number;
  notificationsCreatedCount: number;
  flaggedCandidates: FlaggedCandidateDetail[];
  summary: string;
};

export type ApiNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  recipient?: string;
  entityType?: string;
  entityId?: string;
};

export async function fetchTasks(status: string = "open"): Promise<Task[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tasks?status=${encodeURIComponent(status)}`);
  if (!response.ok) throw new Error(`Tasks request failed with ${response.status}`);
  return response.json() as Promise<Task[]>;
}

export async function completeTask(taskId: string): Promise<Task> {
  return persistedRequest<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}/complete`, "POST");
}

export async function dismissTask(taskId: string): Promise<Task> {
  return persistedRequest<Task>(`/api/v1/tasks/${encodeURIComponent(taskId)}/dismiss`, "POST");
}

export async function assignTask(taskId: string, assignee: string = "Nisha Rao"): Promise<Task> {
  const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${encodeURIComponent(taskId)}/assign?assignee=${encodeURIComponent(assignee)}`, { method: "POST" });
  if (!response.ok) throw new Error(`Assign task failed with ${response.status}`);
  return response.json() as Promise<Task>;
}

export async function runEngagementRules(): Promise<EvaluateRulesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/automations/run-engagement-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Engagement rule run failed with ${response.status}`);
  return response.json() as Promise<EvaluateRulesResponse>;
}

export async function fetchBackendNotifications(): Promise<ApiNotification[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/notifications`);
  if (!response.ok) throw new Error(`Notifications failed with ${response.status}`);
  return response.json() as Promise<ApiNotification[]>;
}

export async function markBackendNotificationsRead(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/notifications/mark-read`, { method: "POST" });
}

export type SendMessageResult = {
  success: boolean;
  channel: string;
  status: string;
  details: string;
  deepLink?: string | null;
  interactionId: string;
  timestamp: string;
  candidateId: string;
  candidateName: string;
  recipient: string;
};

export async function sendMessageToCandidate(
  candidateId: string,
  payload: { channel: string; message: string; subject?: string; recipientOverride?: string; simulated?: boolean }
): Promise<SendMessageResult> {
  return persistedRequest<SendMessageResult>(
    `/api/v1/candidates/${encodeURIComponent(candidateId)}/send-message`,
    "POST",
    payload
  );
}

export function createWhatsAppDeepLink(phone: string, text: string): string {
  let clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  else if (clean.length === 10) clean = "91" + clean;
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

export function createMailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function requestHealth() {
  const response = await fetch(`${API_BASE_URL}/api/v1/health`);
  if (!response.ok) throw new Error(`Backend health check failed with ${response.status}`);
  return response.json() as Promise<{ status: string }>;
}


