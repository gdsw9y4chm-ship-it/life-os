import type {
  LifeAreaRepository,
  GoalRepository,
  ProjectRepository,
  MilestoneRepository,
  LifeAreaInput,
  GoalInput,
  ProjectInput,
  MilestoneInput,
} from "../types/organization";
import { projectProgress, requireRecord } from "./organization-rules";
export type OrganizationCommand =
  | { kind: "life-area"; id?: string; values: LifeAreaInput }
  | { kind: "goal"; id?: string; values: GoalInput }
  | { kind: "project"; id?: string; values: ProjectInput }
  | {
      kind: "milestone";
      id?: string;
      projectId: string;
      values: MilestoneInput;
    }
  | { kind: "reorder-milestones"; projectId: string; ids: string[] };
export class OrganizationService {
  constructor(
    private readonly areas: LifeAreaRepository,
    private readonly goals: GoalRepository,
    private readonly projects: ProjectRepository,
    private readonly milestones: MilestoneRepository,
  ) {}
  snapshot(userId: string) {
    return {
      areas: this.areas.list(userId),
      goals: this.goals.list(userId),
      projects: this.projects.list(userId),
    };
  }
  detail(userId: string, id: string) {
    const project = requireRecord(this.projects.get(userId, id));
    const milestones = this.milestones.list(userId, id);
    return {
      project,
      milestones,
      progress: projectProgress(project, milestones),
    };
  }
  execute(userId: string, command: OrganizationCommand): void {
    switch (command.kind) {
      case "life-area":
        if (command.id) this.areas.update(userId, command.id, command.values);
        else this.areas.create(userId, command.values);
        break;
      case "goal":
        if (command.id) this.goals.update(userId, command.id, command.values);
        else this.goals.create(userId, command.values);
        break;
      case "project":
        if (command.id)
          this.projects.update(userId, command.id, command.values);
        else this.projects.create(userId, command.values);
        break;
      case "milestone":
        requireRecord(this.projects.get(userId, command.projectId));
        if (command.id) {
          const milestone = requireRecord(
            this.milestones.get(userId, command.id),
          );
          if (milestone.project_id !== command.projectId)
            throw new Error("Le milestone appartient à un autre projet.");
          this.milestones.update(userId, command.id, command.values);
        } else
          this.milestones.create(userId, command.projectId, command.values);
        break;
      case "reorder-milestones":
        this.milestones.reorder(userId, command.projectId, command.ids);
        break;
      default:
        throw new Error("Opération inconnue.");
    }
  }
}
