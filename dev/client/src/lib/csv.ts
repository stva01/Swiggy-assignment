/* Logic layer utility: deterministic CSV export for the currently visible candidate roster. */
import type { Candidate } from "./mockData";

const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function downloadCandidatesCsv(records: Candidate[]) {
  const header = ["Candidate", "Role", "Department", "Location", "Recruiter", "Joining date", "Days to join", "Risk", "AI risk", "Engagement", "Last contact days", "Next recommended action"];
  const rows = records.map((candidate) => [candidate.name, candidate.role, candidate.department, candidate.location, candidate.recruiter, candidate.joiningDate, candidate.daysToJoin, candidate.risk, candidate.aiRisk, candidate.engagement, candidate.lastContactDays, candidate.nextAction]);
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `post-offer-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
