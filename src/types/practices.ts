export interface Habit {
  id: string;
  user_id: string;
  title: string;
  life_area_id: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}
export interface HabitRule {
  habit_id: string;
  effective_from: string;
  frequency: "days" | "weekly" | "monthly" | "interval";
  weekdays: number[];
  every_days: number;
  quota: number;
  target_kind: "count" | "quantity" | "duration";
  target: number;
  unit: string;
}
export type HabitInput = Pick<Habit, "title" | "life_area_id"> &
  Omit<HabitRule, "habit_id" | "effective_from"> & { start_day: string };
export interface HabitEntry {
  habit_id: string;
  day: string;
  status: "done" | "skip" | "missed" | "progress";
  value: number;
  note: string;
  updated_at: string;
}
export interface HabitPause {
  id: string;
  habit_id: string;
  from_day: string;
  to_day: string | null;
}
export interface HabitDay {
  note: string;
  day: string;
  state: "done" | "skip" | "missed" | "progress" | "pending" | "paused" | "off";
  value: number;
  target: number;
  timer_minutes: number;
}
export interface HabitSummary {
  habit: Habit;
  rule: HabitRule;
  day: HabitDay;
  period: {
    from: string;
    to: string;
    completed: number;
    target: number;
    state: "done" | "progress" | "missed" | "paused";
  };
  history: HabitDay[];
  paused: boolean;
}
export interface Routine {
  id: string;
  user_id: string;
  title: string;
  archived: number;
  created_at: string;
  updated_at: string;
}
export interface RoutineStep {
  id: string;
  routine_id: string;
  title: string;
  kind: "simple" | "checklist" | "task" | "habit" | "timer";
  checklist: string[];
  task_id: string | null;
  habit_id: string | null;
  target_minutes: number | null;
  position: number;
  archived: number;
}
export type StepInput = Pick<
  RoutineStep,
  "title" | "kind" | "checklist" | "task_id" | "habit_id" | "target_minutes"
>;
export interface RoutineRun {
  id: string;
  routine_id: string;
  user_id: string;
  title: string;
  status: "running" | "completed";
  current_step: number;
  started_at: string;
  ended_at: string | null;
}
export interface RunStep extends Omit<RoutineStep, "routine_id" | "archived"> {
  run_id: string;
  source_step_id: string;
  checks: boolean[];
  status: "pending" | "done" | "skip";
  completed_at: string | null;
}
export interface Tracker {
  id: string;
  user_id: string;
  title: string;
  kind: "number" | "duration" | "counter" | "boolean" | "scale";
  unit: string;
  target: number | null;
  frequency: "daily" | "weekly" | "monthly";
  scale_min: number;
  scale_max: number;
  archived: number;
  created_at: string;
  updated_at: string;
}
export type TrackerInput = Pick<
  Tracker,
  "title" | "kind" | "unit" | "target" | "frequency" | "scale_min" | "scale_max"
>;
export interface TrackerEntry {
  tracker_id: string;
  day: string;
  value: number;
  note: string;
  updated_at: string;
}
export type PracticeCommand =
  | { kind: "habit-save"; id?: string; values: HabitInput }
  | {
      kind: "habit-log";
      id: string;
      day: string;
      status: HabitEntry["status"];
      value: number;
      note?: string;
    }
  | { kind: "habit-pause"; id: string; paused: boolean }
  | {
      kind: "archive";
      type: "habit" | "routine" | "tracker";
      id: string;
      archived: boolean;
    }
  | { kind: "routine-save"; id?: string; title: string }
  | { kind: "step-save"; routineId: string; id?: string; values: StepInput }
  | { kind: "step-remove"; routineId: string; id: string }
  | { kind: "step-move"; routineId: string; id: string; direction: -1 | 1 }
  | { kind: "run-start"; routineId: string }
  | { kind: "run-move"; id: string; direction: -1 | 1 }
  | {
      kind: "run-check";
      id: string;
      stepId: string;
      index: number;
      checked: boolean;
    }
  | { kind: "run-step"; id: string; stepId: string; status: "done" | "skip" }
  | { kind: "tracker-save"; id?: string; values: TrackerInput }
  | {
      kind: "tracker-entry";
      id: string;
      day: string;
      value: number;
      note?: string;
      increment?: boolean;
    };
