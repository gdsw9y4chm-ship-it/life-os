export type PlannerKind = "event" | "time_block" | "scheduled_task";
export type Frequency = "once" | "daily" | "weekly" | "monthly";
export type EditScope = "occurrence" | "future" | "series";
export interface PlannerInput {
  kind: PlannerKind;
  title: string;
  start_local: string;
  duration_minutes: number;
  timezone: string;
  frequency: Frequency;
  interval_count: number;
  weekdays: number[];
  until_day: string | null;
  task_id?: string | null;
  project_id?: string | null;
  life_area_id?: string | null;
  location?: string;
  description?: string;
}
export interface PlannerSeries extends PlannerInput {
  id: string;
  user_id: string;
  archived: number;
  created_at: string;
  updated_at: string;
  task_status: string | null;
}
export interface PlannerException {
  series_id: string;
  occurrence_day: string;
  cancelled: number;
  start_local: string | null;
  duration_minutes: number | null;
  title: string | null;
}
export interface Occurrence {
  series: PlannerSeries;
  key: string;
  day: string;
  start: string;
  end: string;
  title: string;
}
export interface CalendarProvider {
  id: string;
  list(start: string, end: string): Promise<ExternalEvent[]>;
}
export interface ExternalEvent {
  id: string;
  provider_id: string;
  calendar_id: string;
  title: string;
  start: string;
  end: string;
  readonly: true;
}
export interface RoutinePlacementSource {
  routine_id: string;
  run_id?: string;
}
