/* Masala Ops data model: grounded sample candidate records, journey stages, tasks, and analytics values for the frontend demo. */

export type RiskLevel = "low" | "medium" | "high";
export type StepStatus = "completed" | "pending" | "overdue";
export type TaskSource = "system" | "AI" | "human";

export type JourneyStep = {
  key: string;
  label: string;
  shortLabel: string;
  due: string;
  status: StepStatus;
};

export type Candidate = {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string;
  location: string;
  recruiter: string;
  recruiterInitials: string;
  offerDate: string;
  joiningDate: string;
  joiningDayLabel: string;
  daysToJoin: number;
  risk: RiskLevel;
  aiRisk: RiskLevel;
  overrideReason?: string;
  phone?: string;
  engagement: "on track" | "needs attention" | "at risk";
  lastContactDays: number;
  nextAction: string;
  email: string;
  steps: JourneyStep[];
};

export type Task = {
  id: string;
  candidateId: string;
  candidate: string;
  dueLabel: string;
  dueGroup: "Overdue" | "Today" | "Upcoming";
  action: string;
  source: TaskSource;
  accent: "orange" | "tomato" | "sage";
};

const steps = (statuses: StepStatus[], dueDates: string[]): JourneyStep[] => {
  const names = [
    ["offer_accepted", "Offer accepted", "Offer"],
    ["welcome", "Welcome note", "Welcome"],
    ["documentation", "Documentation", "Docs"],
    ["manager_intro", "Manager intro", "Manager"],
    ["pre_joining_checkin", "Pre-joining check-in", "Check-in"],
    ["joining", "Joining day", "Joining"],
  ];

  return names.map(([key, label, shortLabel], index) => ({
    key,
    label,
    shortLabel,
    due: dueDates[index],
    status: statuses[index],
  }));
};

export const candidates: Candidate[] = [
  {
    id: "c-101",
    name: "Aarav Mehta",
    initials: "AM",
    role: "Senior Product Designer",
    department: "Design",
    location: "Bengaluru",
    recruiter: "Nisha Rao",
    recruiterInitials: "NR",
    offerDate: "05 Aug 2026",
    joiningDate: "12 Sep 2026",
    joiningDayLabel: "12 Sep",
    daysToJoin: 13,
    risk: "low",
    aiRisk: "low",
    engagement: "on track",
    lastContactDays: 2,
    nextAction: "Share the Bengaluru office guide",
    email: "aarav.mehta@example.com",
    steps: steps(["completed", "completed", "completed", "pending", "pending", "pending"], ["05 Aug", "06 Aug", "09 Aug", "24 Aug", "03 Sep", "12 Sep"]),
  },
  {
    id: "c-102",
    name: "Diya Shah",
    initials: "DS",
    role: "Growth Marketing Manager",
    department: "Marketing",
    location: "Mumbai",
    recruiter: "Kabir Menon",
    recruiterInitials: "KM",
    offerDate: "29 Jul 2026",
    joiningDate: "28 Aug 2026",
    joiningDayLabel: "28 Aug",
    daysToJoin: 2,
    risk: "high",
    aiRisk: "high",
    engagement: "at risk",
    lastContactDays: 11,
    nextAction: "Call to confirm relocation plan",
    email: "diya.shah@example.com",
    steps: steps(["completed", "completed", "overdue", "pending", "overdue", "pending"], ["29 Jul", "30 Jul", "04 Aug", "12 Aug", "20 Aug", "28 Aug"]),
  },
  {
    id: "c-103",
    name: "Rohan Iyer",
    initials: "RI",
    role: "Backend Engineer II",
    department: "Engineering",
    location: "Hyderabad",
    recruiter: "Nisha Rao",
    recruiterInitials: "NR",
    offerDate: "02 Aug 2026",
    joiningDate: "05 Sep 2026",
    joiningDayLabel: "05 Sep",
    daysToJoin: 6,
    risk: "medium",
    aiRisk: "high",
    overrideReason: "Spoke today; family plans are confirmed.",
    engagement: "needs attention",
    lastContactDays: 1,
    nextAction: "Send manager intro and team map",
    email: "rohan.iyer@example.com",
    steps: steps(["completed", "completed", "completed", "pending", "pending", "pending"], ["02 Aug", "03 Aug", "08 Aug", "26 Aug", "01 Sep", "05 Sep"]),
  },
  {
    id: "c-104",
    name: "Meera Krishnan",
    initials: "MK",
    role: "Customer Success Lead",
    department: "Customer Success",
    location: "Pune",
    recruiter: "Sana Kapoor",
    recruiterInitials: "SK",
    offerDate: "20 Jul 2026",
    joiningDate: "01 Sep 2026",
    joiningDayLabel: "01 Sep",
    daysToJoin: 4,
    risk: "medium",
    aiRisk: "medium",
    engagement: "needs attention",
    lastContactDays: 6,
    nextAction: "Nudge for signed documentation",
    email: "meera.krishnan@example.com",
    steps: steps(["completed", "completed", "overdue", "completed", "pending", "pending"], ["20 Jul", "21 Jul", "25 Jul", "01 Aug", "28 Aug", "01 Sep"]),
  },
  {
    id: "c-105",
    name: "Ishaan Verma",
    initials: "IV",
    role: "Data Analyst",
    department: "Data",
    location: "Gurugram",
    recruiter: "Kabir Menon",
    recruiterInitials: "KM",
    offerDate: "10 Aug 2026",
    joiningDate: "21 Sep 2026",
    joiningDayLabel: "21 Sep",
    daysToJoin: 22,
    risk: "low",
    aiRisk: "low",
    engagement: "on track",
    lastContactDays: 3,
    nextAction: "Schedule a quick manager hello",
    email: "ishaan.verma@example.com",
    steps: steps(["completed", "completed", "pending", "pending", "pending", "pending"], ["10 Aug", "11 Aug", "18 Aug", "05 Sep", "14 Sep", "21 Sep"]),
  },
  {
    id: "c-106",
    name: "Tara Fernandes",
    initials: "TF",
    role: "People Operations Partner",
    department: "People",
    location: "Bengaluru",
    recruiter: "Sana Kapoor",
    recruiterInitials: "SK",
    offerDate: "07 Aug 2026",
    joiningDate: "15 Sep 2026",
    joiningDayLabel: "15 Sep",
    daysToJoin: 16,
    risk: "low",
    aiRisk: "low",
    engagement: "on track",
    lastContactDays: 4,
    nextAction: "Send first-week calendar preview",
    email: "tara.fernandes@example.com",
    steps: steps(["completed", "completed", "completed", "pending", "pending", "pending"], ["07 Aug", "08 Aug", "13 Aug", "29 Aug", "08 Sep", "15 Sep"]),
  },
  {
    id: "c-107",
    name: "Nikhil Batra",
    initials: "NB",
    role: "Frontend Engineer",
    department: "Engineering",
    location: "Chennai",
    recruiter: "Nisha Rao",
    recruiterInitials: "NR",
    offerDate: "01 Aug 2026",
    joiningDate: "29 Aug 2026",
    joiningDayLabel: "29 Aug",
    daysToJoin: 3,
    risk: "high",
    aiRisk: "high",
    engagement: "at risk",
    lastContactDays: 8,
    nextAction: "Resolve laptop preference blocker",
    email: "nikhil.batra@example.com",
    steps: steps(["completed", "completed", "completed", "overdue", "overdue", "pending"], ["01 Aug", "02 Aug", "07 Aug", "18 Aug", "24 Aug", "29 Aug"]),
  },
  {
    id: "c-108",
    name: "Sana Qureshi",
    initials: "SQ",
    role: "Content Strategist",
    department: "Brand",
    location: "Mumbai",
    recruiter: "Kabir Menon",
    recruiterInitials: "KM",
    offerDate: "12 Aug 2026",
    joiningDate: "25 Sep 2026",
    joiningDayLabel: "25 Sep",
    daysToJoin: 26,
    risk: "low",
    aiRisk: "low",
    engagement: "on track",
    lastContactDays: 2,
    nextAction: "Invite to the brand team coffee",
    email: "sana.qureshi@example.com",
    steps: steps(["completed", "pending", "pending", "pending", "pending", "pending"], ["12 Aug", "13 Aug", "20 Aug", "10 Sep", "18 Sep", "25 Sep"]),
  },
];

export const tasks: Task[] = [
  { id: "t-01", candidateId: "c-102", candidate: "Diya Shah", dueLabel: "2 days overdue", dueGroup: "Overdue", action: "Confirm relocation support", source: "AI", accent: "tomato" },
  { id: "t-02", candidateId: "c-107", candidate: "Nikhil Batra", dueLabel: "1 day overdue", dueGroup: "Overdue", action: "Resolve laptop preference", source: "system", accent: "tomato" },
  { id: "t-03", candidateId: "c-104", candidate: "Meera Krishnan", dueLabel: "Due today", dueGroup: "Today", action: "Nudge for signed documentation", source: "human", accent: "orange" },
  { id: "t-04", candidateId: "c-103", candidate: "Rohan Iyer", dueLabel: "Due today", dueGroup: "Today", action: "Send manager introduction", source: "system", accent: "orange" },
  { id: "t-05", candidateId: "c-101", candidate: "Aarav Mehta", dueLabel: "Tomorrow", dueGroup: "Upcoming", action: "Share Bengaluru office guide", source: "AI", accent: "sage" },
  { id: "t-06", candidateId: "c-106", candidate: "Tara Fernandes", dueLabel: "30 Aug", dueGroup: "Upcoming", action: "Send first-week calendar preview", source: "AI", accent: "sage" },
];

export const funnelData = [
  { stage: "Offer accepted", reached: 48, stalled: 2 },
  { stage: "Welcome", reached: 46, stalled: 4 },
  { stage: "Documentation", reached: 42, stalled: 6 },
  { stage: "Manager intro", reached: 36, stalled: 4 },
  { stage: "Check-in", reached: 27, stalled: 7 },
  { stage: "Joining", reached: 19, stalled: 8 },
];

export const joiningWindow = [
  { label: "Aug 24", candidates: 3 },
  { label: "Aug 31", candidates: 7 },
  { label: "Sep 07", candidates: 5 },
  { label: "Sep 14", candidates: 9 },
  { label: "Sep 21", candidates: 6 },
  { label: "Sep 28", candidates: 4 },
];

export const recruiterStats = [
  { name: "Nisha Rao", initials: "NR", joined: 12, offered: 15, rate: 80, inFlight: 18, highRisk: 2 },
  { name: "Kabir Menon", initials: "KM", joined: 11, offered: 16, rate: 69, inFlight: 14, highRisk: 3 },
  { name: "Sana Kapoor", initials: "SK", joined: 9, offered: 11, rate: 82, inFlight: 12, highRisk: 1 },
];

export const interactions = [
  { id: "i-01", channel: "WhatsApp", direction: "out", timestamp: "Today, 10:42 AM", text: "Hi Diya — checking in on your move to Mumbai. Is there anything we can unblock before your 28 Aug start?", tone: "Friendly check-in" },
  { id: "i-02", channel: "Email", direction: "in", timestamp: "Yesterday, 6:08 PM", text: "Thanks, Nisha. I am still figuring out relocation and accommodation, so a quick call would help.", tone: "Candidate reply" },
  { id: "i-03", channel: "WhatsApp", direction: "out", timestamp: "19 Aug, 4:18 PM", text: "Sharing a short overview of your first week and the people you will meet on day one.", tone: "Welcome note" },
  { id: "i-04", channel: "Email", direction: "in", timestamp: "17 Aug, 12:25 PM", text: "Offer accepted — excited to meet the growth team.", tone: "Candidate reply" },
];
