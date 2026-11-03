import type { User } from "./user";
import type { Project } from "./organization";
import type { TaskPriority, TaskSummary } from "./task";

export interface TodayCounts {
  inboxCount: number;
  overdueCount: number;
  followUpCount: number;
  todayProjectCount: number;
}
export interface TodayProject extends Project {
  life_area_name: string | null;
  today_task_count: number;
  openTaskCount: number;
  progress: number | null;
}
export interface TodayData extends TodayCounts {
  user: User;
  day: string;
  dateLabel: string;
  todayTasks: TaskSummary[];
  groups: { priority: TaskPriority; tasks: TaskSummary[] }[];
  mustCount: number;
  followUps: TaskSummary[];
  activeProjects: TodayProject[];
}
export interface ProjectAggregate {
  project_id: string;
  open_count: number;
  total: number;
  done: number;
}
export interface TodayRepository {
  todayTasks(userId: string, day: string): TaskSummary[];
  followUps(userId: string, day: string): TaskSummary[];
  counts(userId: string, day: string): TodayCounts;
  activeProjects(
    userId: string,
    day: string,
  ): (Project & { life_area_name: string | null; today_task_count: number })[];
  taskAggregates(userId: string, projectIds: string[]): ProjectAggregate[];
  milestoneAggregates(
    userId: string,
    projectIds: string[],
  ): Omit<ProjectAggregate, "open_count">[];
}
