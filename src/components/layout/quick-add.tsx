import {
  CheckCheck,
  CalendarDays,
  NotebookPen,
  Timer,
  Plus,
  Clock3,
  Folder,
  Heart,
  Repeat2,
  SlidersHorizontal,
  List,
  type LucideIcon,
} from "lucide-react";
import { Button, Badge } from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
const quick: [string, LucideIcon][] = [
  ["Task", CheckCheck],
  ["Event", CalendarDays],
  ["Note", NotebookPen],
  ["Start Timer", Timer],
];
const more: [string, LucideIcon][] = [
  ["Time Block", Clock3],
  ["Project", Folder],
  ["Habit", Heart],
  ["Routine", Repeat2],
  ["Tracker Entry", SlidersHorizontal],
  ["List", List],
];
export function QuickAdd({ mobile = false }: { mobile?: boolean }) {
  return (
    <Sheet
      title="Quick Add"
      description="Un point d’entrée pour vos idées. Ces actions seront disponibles dans les prochaines phases."
      trigger={
        <Button
          className={mobile ? "mobile-add" : "quick-add-trigger"}
          aria-label="Ouvrir Quick Add"
        >
          <Plus size={20} aria-hidden="true" />
          {!mobile && "Quick Add"}
        </Button>
      }
    >
      <Badge tone="rose">Aperçu UI · actions indisponibles</Badge>
      <h3 className="group-label">Quick</h3>
      <div className="quick-grid">
        {quick.map(([label, Icon]) => (
          <button type="button" key={label} className="quick-option" disabled>
            <Icon size={24} strokeWidth={1.4} />
            <span>{label}</span>
            <small>À venir</small>
          </button>
        ))}
      </div>
      <h3 className="group-label">More</h3>
      <div className="more-grid">
        {more.map(([label, Icon]) => (
          <button type="button" key={label} className="more-option" disabled>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
