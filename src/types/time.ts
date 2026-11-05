export type TimeSource = {
  kind:
    | "quick"
    | "task"
    | "project"
    | "life_area"
    | "planner"
    | "habit"
    | "routine";
  id?: string;
  key?: string;
};
export interface TimePause {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
}
export interface TimeSession {
  id: string;
  user_id: string;
  title: string;
  status: "running" | "paused" | "completed";
  source_kind: TimeSource["kind"] | "manual";
  task_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  life_area_id: string | null;
  planner_id: string | null;
  habit_id?: string | null;
  routine_run_id?: string | null;
  routine_run_step_id?: string | null;
  occurrence_key: string | null;
  planned_minutes: number | null;
  target_minutes: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}
export type SessionWithPauses = TimeSession & {
  pauses: TimePause[];
  actual_duration: number;
};
export interface StartTime {
  source: TimeSource;
  title?: string;
  target_minutes?: number | null;
  conflict?: "cancel" | "pause" | "stop";
}
export interface ManualTime {
  id?: string;
  title: string;
  started_at: string;
  ended_at: string;
  pauses: { started_at: string; ended_at: string }[];
}
export type TimeCommand =
  | { kind: "start"; values: StartTime }
  | { kind: "pause" | "resume" | "stop"; id: string }
  | { kind: "manual"; values: ManualTime };
