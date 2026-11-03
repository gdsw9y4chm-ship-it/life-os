export const goalTypes = [
  "numeric",
  "frequency",
  "duration",
  "milestones",
  "manual",
] as const;
export const goalStatuses = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export const projectStatuses = [
  "active",
  "paused",
  "waiting",
  "someday",
  "completed",
  "archived",
] as const;
export const progressModes = [
  "task_based",
  "milestones",
  "manual",
  "none",
] as const;
export const milestoneStatuses = [
  "pending",
  "in_progress",
  "completed",
] as const;
export type GoalType = (typeof goalTypes)[number];
export type GoalStatus = (typeof goalStatuses)[number];
export type ProjectStatus = (typeof projectStatuses)[number];
export type ProgressMode = (typeof progressModes)[number];
export type MilestoneStatus = (typeof milestoneStatuses)[number];
interface RecordDates {
  id: string;
  created_at: string;
  updated_at: string;
}
export interface LifeArea extends RecordDates {
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  is_archived: boolean;
}
export interface Goal extends RecordDates {
  user_id: string;
  title: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  target_value: number | null;
  target_unit: string | null;
  target_date: string | null;
}
export interface Project extends RecordDates {
  user_id: string;
  life_area_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  deadline: string | null;
  progress_mode: ProgressMode;
  manual_progress: number | null;
  position: number;
}
export interface Milestone extends RecordDates {
  project_id: string;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  position: number;
  target_date: string | null;
}
export type LifeAreaInput = Pick<LifeArea, "name"> &
  Partial<Pick<LifeArea, "description" | "icon" | "position" | "is_archived">>;
export type GoalInput = Pick<Goal, "title" | "type"> &
  Partial<
    Pick<
      Goal,
      "description" | "status" | "target_value" | "target_unit" | "target_date"
    >
  >;
export type ProjectInput = Pick<Project, "title"> &
  Partial<
    Pick<
      Project,
      | "description"
      | "status"
      | "life_area_id"
      | "goal_id"
      | "start_date"
      | "deadline"
      | "progress_mode"
      | "manual_progress"
      | "position"
    >
  >;
export type MilestoneInput = Pick<Milestone, "title"> &
  Partial<
    Pick<Milestone, "description" | "status" | "position" | "target_date">
  >;
export interface LifeAreaRepository {
  list(userId: string): LifeArea[];
  get(userId: string, id: string): LifeArea | null;
  create(userId: string, input: LifeAreaInput): LifeArea;
  update(userId: string, id: string, input: Partial<LifeAreaInput>): LifeArea;
  archive(userId: string, id: string): LifeArea;
  reorder(userId: string, ids: string[]): void;
}
export interface GoalRepository {
  list(userId: string): Goal[];
  get(userId: string, id: string): Goal | null;
  create(userId: string, input: GoalInput): Goal;
  update(userId: string, id: string, input: Partial<GoalInput>): Goal;
  archive(userId: string, id: string): Goal;
}
export interface ProjectRepository {
  list(userId: string): Project[];
  get(userId: string, id: string): Project | null;
  create(userId: string, input: ProjectInput): Project;
  update(userId: string, id: string, input: Partial<ProjectInput>): Project;
  archive(userId: string, id: string): Project;
}
export interface MilestoneRepository {
  list(userId: string, projectId: string): Milestone[];
  get(userId: string, id: string): Milestone | null;
  create(userId: string, projectId: string, input: MilestoneInput): Milestone;
  update(userId: string, id: string, input: Partial<MilestoneInput>): Milestone;
  reorder(userId: string, projectId: string, ids: string[]): void;
}
