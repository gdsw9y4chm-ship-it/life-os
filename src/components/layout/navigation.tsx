import { Link } from "@tanstack/react-router";
import {
  Sun,
  CalendarDays,
  Folder,
  CheckCheck,
  NotebookPen,
  Repeat2,
  Heart,
  ChartNoAxesCombined,
  type LucideIcon,
} from "lucide-react";
export const destinations = [
  {
    to: "/today",
    label: "Today",
    icon: Sun,
    description: "Votre quotidien, bientôt réuni ici.",
    emptyTitle: "Une place pour chaque journée.",
    detail:
      "Priorités, planning et moments pour vous trouveront leur place ici. Today sera développé dans une prochaine phase.",
  },
  {
    to: "/planner",
    label: "Planner",
    icon: CalendarDays,
    description: "Du temps pour ce qui compte.",
    emptyTitle: "Faites de la place à vos envies.",
    detail:
      "Le calendrier et les créneaux de votre semaine seront développés dans une prochaine phase.",
  },
  {
    to: "/projects",
    label: "Projects",
    icon: Folder,
    description: "Les idées qui méritent de prendre vie.",
    emptyTitle: "Le début de quelque chose.",
    detail:
      "Vos projets, étapes et relations seront développés dans une prochaine phase.",
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: CheckCheck,
    description: "Un peu de clarté, une chose à la fois.",
    emptyTitle: "L’esprit libre pour la suite.",
    detail:
      "La capture et l’organisation des tâches seront développées dans une prochaine phase.",
  },
  {
    to: "/notes",
    label: "Notes",
    icon: NotebookPen,
    description: "Un espace pour vos pensées.",
    emptyTitle: "Laissez les idées venir.",
    detail:
      "L’écriture, la capture et les liens entre notes seront développés dans une prochaine phase.",
  },
  {
    to: "/routines",
    label: "Routines",
    icon: Repeat2,
    description: "Les petits gestes qui vous ressemblent.",
    emptyTitle: "À votre rythme.",
    detail:
      "Vos routines et leurs étapes seront développées dans une prochaine phase.",
  },
  {
    to: "/life",
    label: "Life",
    icon: Heart,
    description: "Toutes les facettes de votre univers.",
    emptyTitle: "Votre vie, tout simplement.",
    detail:
      "Les domaines de vie, objectifs et habitudes seront développés dans une prochaine phase.",
  },
  {
    to: "/review",
    label: "Review",
    icon: ChartNoAxesCombined,
    description: "Un temps pour prendre du recul.",
    emptyTitle: "Un regard sur le chemin parcouru.",
    detail:
      "Les bilans et les resets seront développés dans une prochaine phase, à partir de vos données réelles.",
  },
] as const;
export type Destination = (typeof destinations)[number];
export function NavigationItem({
  to,
  label,
  icon: Icon,
  onNavigate,
  compact = false,
}: {
  to: Destination["to"];
  label: string;
  icon: LucideIcon;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`navigation-item ${compact ? "navigation-item--compact" : ""}`}
      activeProps={{ className: "is-active", "aria-current": "page" }}
      activeOptions={{ exact: to !== "/projects" && to !== "/tasks" }}
      onClick={onNavigate}
    >
      <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
