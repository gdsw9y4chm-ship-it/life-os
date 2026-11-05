import { Link } from "@tanstack/react-router";
import { Button } from "../../design-system/components/primitives";
import { getTodayPractices } from "./api";
import { usePracticeMutation, dayStates } from "./shared";
export function TodayPractices({
  data,
}: {
  data: Awaited<ReturnType<typeof getTodayPractices>>;
}) {
  const m = usePracticeMutation();
  return (
    <section className="practice-card">
      <p className="eyebrow">À votre rythme</p>
      <h2>Habits &amp; Routines</h2>
      {m.error && <p role="alert">{m.error}</p>}
      <div className="practice-compact">
        {data.habits.map((h) => (
          <article key={h.habit.id}>
            <div>
              <Link to="/life/habits" search={{ archived: false }}>
                {h.habit.title}
              </Link>
              <p className="practice-hint">
                {["weekly", "monthly"].includes(h.rule.frequency)
                  ? `${h.period.completed} / ${h.period.target} jours · `
                  : ""}
                {dayStates[h.day.state]}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={m.busy || h.day.state === "done"}
              onClick={() =>
                void m.run({
                  kind: "habit-log",
                  id: h.habit.id,
                  day: h.day.day,
                  status: "done",
                  value: Math.max(
                    0,
                    h.rule.target -
                      (h.rule.target_kind === "duration"
                        ? h.day.timer_minutes
                        : 0),
                  ),
                })
              }
            >
              Done
            </Button>
          </article>
        ))}
        {data.routines.map((r) => (
          <article key={r.id}>
            <Link to="/routines" search={{ archived: false, routineId: r.id }}>
              {r.title}
            </Link>
            <span className="practice-hint">Routine</span>
          </article>
        ))}
      </div>
      {!data.habits.length && !data.routines.length && (
        <p className="practice-hint">
          Vos habitudes et routines apparaîtront ici lorsque vous en aurez créé.
        </p>
      )}
      <div className="practice-actions">
        <Link to="/life/habits" search={{ archived: false }}>
          Toutes les Habits
        </Link>
        <Link to="/routines" search={{ archived: false }}>
          Routines
        </Link>
      </div>
    </section>
  );
}
