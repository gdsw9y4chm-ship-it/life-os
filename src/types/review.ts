export type ReviewMode = "week" | "month";
export type ResetKind = "weekly" | "monthly";
export const resetSteps = {
  weekly: [
    "Inbox",
    "Overdue",
    "Waiting",
    "Projects",
    "Habits",
    "Time Review",
    "Weekly Priorities",
    "Plan Next Week",
  ],
  monthly: [
    "Last Month",
    "Clean Up",
    "Projects",
    "Goals",
    "Focus Areas",
    "Month Calendar",
    "Monthly Priorities",
  ],
} as const;
export interface ResetRun {
  id: string;
  user_id: string;
  kind: ResetKind;
  period_start: string;
  period_end: string;
  cursor: number;
  steps: ("done" | "skip" | null)[];
  priorities: string[];
  notes: Record<string, string>;
  revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
export type ResetCommand =
  | { kind: "start"; mode: ReviewMode; day: string }
  | { kind: "move"; id: string; revision: number; direction: -1 | 1 }
  | { kind: "step"; id: string; revision: number; status: "done" | "skip" }
  | { kind: "priorities"; id: string; revision: number; values: string[] }
  | { kind: "note"; id: string; revision: number; text: string };
