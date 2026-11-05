import { useHydrated } from "../../lib/use-hydrated";
import { useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useRouter,
  useBlocker,
} from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Textarea,
  Progress,
} from "../../design-system/components/primitives";
import { AngelWings, Crystal } from "../../design-system/components/ornaments";
import { getReview, saveReset } from "./api";
import { saveTask } from "../tasks/api";
import { resetSteps, type ResetCommand } from "../../types/review";
import type { Task, TaskView } from "../../types/task";
type Data = Awaited<ReturnType<typeof getReview>>;
const time = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
};
const taskSearch = (view: TaskView) => ({
  view,
  context: "",
  q: "",
  project: "",
  area: "",
});
function useResetMutation() {
  const router = useRouter(),
    lock = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(data: ResetCommand) {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await saveReset({ data });
      if (!r.ok) {
        setError(r.error);
        return null;
      }
      await router.invalidate();
      return r.id;
    } catch {
      setError("Enregistrement impossible. Vos saisies restent visibles.");
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error };
}
export function ReviewView({ data }: { data: Data }) {
  const hydrated = useHydrated();
  const nav = useNavigate(),
    m = useResetMutation();
  return (
    <PageLayout
      title={
        data.run
          ? data.run.kind === "weekly"
            ? "Weekly Reset"
            : "Monthly Reset"
          : "Review"
      }
      subtitle={
        data.run
          ? "Faire le point, choisir la suite."
          : "Votre temps et vos engagements, sans score."
      }
    >
      {data.run ? (
        <ResetView data={data} />
      ) : (
        <>
          <div className="review-toolbar">
            <nav aria-label="Période des Insights">
              <Link
                to="/review"
                search={{ mode: "week", day: data.period.from }}
                className={data.mode === "week" ? "is-selected" : ""}
              >
                Week
              </Link>
              <Link
                to="/review"
                search={{ mode: "month", day: data.period.from }}
                className={data.mode === "month" ? "is-selected" : ""}
              >
                Month
              </Link>
            </nav>
            <Button
              variant="ghost"
              aria-label="Période précédente"
              onClick={() =>
                void nav({
                  to: "/review",
                  search: { mode: data.mode, day: data.period.previous },
                })
              }
            >
              ←
            </Button>
            <Input
              label="Date du bilan"
              disabled={!hydrated}
              type="date"
              value={data.period.from}
              onChange={(e) => {
                if (e.target.value)
                  void nav({
                    to: "/review",
                    search: { mode: data.mode, day: e.target.value },
                  });
              }}
            />
            <Button
              variant="ghost"
              aria-label="Période suivante"
              onClick={() =>
                void nav({
                  to: "/review",
                  search: { mode: data.mode, day: data.period.next },
                })
              }
            >
              →
            </Button>
          </div>
          <p className="review-period">
            {data.period.from} — {data.period.to} · {data.timezone}
          </p>
          <Insights data={data} />
          <section className="review-reset-start">
            <Crystal />
            <div>
              <h2>{data.mode === "week" ? "Weekly Reset" : "Monthly Reset"}</h2>
              <p>
                {data.mode === "month"
                  ? `Bilan du mois précédent (${data.period.previous}).`
                  : "Un passage guidé pour cette semaine."}{" "}
                Vos choix et votre progression sont conservés.
              </p>
            </div>
            <Button
              disabled={m.busy || data.period.from > data.today}
              onClick={() =>
                void m
                  .run({
                    kind: "start",
                    mode: data.mode,
                    day:
                      data.mode === "month"
                        ? data.period.previous
                        : data.period.from,
                  })
                  .then((id) => {
                    if (id)
                      void nav({
                        to: "/review",
                        search: {
                          mode: data.mode,
                          day: data.period.from,
                          runId: id,
                        },
                      });
                  })
              }
            >
              Commencer le Reset
            </Button>
            {m.error && <p role="alert">{m.error}</p>}
          </section>
          <details className="review-history">
            <summary>Resets conservés · {data.runs.length}</summary>
            {data.runs.map((r) => (
              <p key={r.id}>
                <Link
                  to="/review"
                  search={{
                    mode: r.kind === "weekly" ? "week" : "month",
                    day: r.period_start,
                    runId: r.id,
                  }}
                >
                  {r.kind === "weekly" ? "Weekly" : "Monthly"} ·{" "}
                  {r.period_start} · {r.completed_at ? "Terminé" : "En cours"}
                </Link>
              </p>
            ))}
          </details>
        </>
      )}
    </PageLayout>
  );
}
function Insights({
  data,
  compact = false,
}: {
  data: Data;
  compact?: boolean;
}) {
  const attributed = data.projects.reduce((n, p) => n + p.seconds, 0);
  return (
    <div className="review-insights">
      <div className="review-metrics">
        <article>
          <span>Tracked Time</span>
          <strong>{time(data.total)}</strong>
        </article>
        <article>
          <span>Tasks créées</span>
          <strong>{data.counts.created}</strong>
        </article>
        <article>
          <span>Tasks terminées</span>
          <strong>{data.counts.completed}</strong>
        </article>
        <article>
          <span>Waiting · maintenant</span>
          <strong>{data.counts.waiting}</strong>
        </article>
      </div>
      <div className="review-columns">
        <section className="review-panel">
          <h2>Life Balance</h2>
          <p>Répartition du temps réellement suivi, hors pauses.</p>
          {!data.byArea.length && (
            <p>
              Aucun temps enregistré sur cette période ni les quatre semaines
              précédentes.
            </p>
          )}
          {data.byArea.map((a) => (
            <div className="review-bar" key={a.id ?? "none"}>
              <div>
                <strong>{a.title}</strong>
                <span>{time(a.seconds)}</span>
              </div>
              <Progress
                label={`Part du temps · ${a.title}`}
                value={data.total ? (a.seconds / data.total) * 100 : 0}
              />
              {data.mode === "week" && (
                <small>
                  Moyenne hebdomadaire des 4 semaines précédentes :{" "}
                  {time(a.previousWeekly)}
                </small>
              )}
            </div>
          ))}
        </section>
        <section className="review-panel">
          <h2>Planned vs Actual</h2>
          {!data.comparisons.length ? (
            <p>Aucun créneau chronométré sur cette période.</p>
          ) : (
            data.comparisons.map((c, i) => (
              <div className="review-row" key={i}>
                <strong>{c.title}</strong>
                <span>
                  {time(c.planned)} prévues · {time(c.actual)} suivies
                </span>
              </div>
            ))
          )}
          <p className="review-limit">
            Comparaison des créneaux reliés à une session : durée prévue
            conservée à la création, temps réel limité à la période. Un créneau
            sans session n’est pas assimilé à un échec.
          </p>
        </section>
      </div>
      {!compact && (
        <>
          <section className="review-panel">
            <h2>Projects</h2>
            <p>
              Temps sur la période ; progression et état des tâches actuels.
            </p>
            {data.projects.length === 0 && <p>Aucun Project créé.</p>}
            <div className="review-projects">
              {data.projects.map((p) => (
                <article key={p.id}>
                  <Link to="/projects/$projectId" params={{ projectId: p.id }}>
                    {p.title}
                  </Link>
                  <p>
                    {time(p.seconds)} · {p.doneCount} / {p.taskCount} tâches
                  </p>
                  {p.progress !== null ? (
                    <Progress label="Progression actuelle" value={p.progress} />
                  ) : (
                    <p>Progression non définie</p>
                  )}
                  <small>
                    Dernière activité enregistrée :{" "}
                    {p.lastActivity.slice(0, 10)}
                  </small>
                  {p.inactive && (
                    <p className="review-limit">
                      Actif · aucune activité enregistrée depuis 28 jours.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="review-limit">
              Sans Project : {time(Math.max(0, data.total - attributed))}.
              L’activité inclut les modifications enregistrées et les sessions ;
              elle ne mesure pas le travail hors Life OS.
            </p>
          </section>
          <section className="review-panel">
            <h2>Habits</h2>
            <p>Jours réussis et états conservés dans la période.</p>
            {!data.habits.length && <p>Aucune Habit pour cette période.</p>}
            {data.habits.map((h) => (
              <div className="review-row" key={h.id}>
                <Link
                  to="/life/habits"
                  search={{
                    archived: h.archived,
                    day:
                      data.period.to > data.today ? data.today : data.period.to,
                  }}
                >
                  {h.title}
                </Link>
                <span>
                  {h.done} jours réussis · {h.skip} Skip · {h.paused} en pause
                  {h.missed ? ` · ${h.missed} Missed` : ""}
                </span>
                {["weekly", "monthly"].includes(h.frequency ?? "") && (
                  <small>
                    Fréquence à la fin de période : {h.quota} /{" "}
                    {h.frequency === "weekly" ? "semaine" : "mois"}. Les jours
                    non renseignés ne sont pas des échecs quotidiens.
                  </small>
                )}
              </div>
            ))}
          </section>
          <section className="review-panel">
            <h2>Time Targets</h2>
            {data.timeTargets.length ? (
              data.timeTargets.map((t) => (
                <div className="review-row" key={t.id}>
                  <span>{t.title}</span>
                  <span>
                    {time(t.seconds)} dans la période · cible de session{" "}
                    {t.target} min
                  </span>
                </div>
              ))
            ) : (
              <p>
                Aucun objectif de session renseigné pour le temps suivi ici.
              </p>
            )}
            <p className="review-limit">
              Les quotas récurrents par domaine ne sont pas encore disponibles.
            </p>
          </section>
        </>
      )}
      <p className="review-limit">
        Les compteurs reflètent les enregistrements conservés. Waiting et la
        progression des Projects décrivent l’état actuel ; Life OS ne
        reconstruit pas leurs états passés. Les complétions annulées ne figurent
        plus dans le bilan. Aucun score de productivité.
      </p>
    </div>
  );
}
function TaskActions({ items, view }: { items: Task[]; view: TaskView }) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Link to="/tasks" search={taskSearch(view)}>
        Ouvrir {view}
      </Link>
      {!items.length && <p>Rien à traiter ici.</p>}
      {items.map((t) => (
        <div className="review-row" key={t.id}>
          <Link to="/tasks/$taskId" params={{ taskId: t.id }}>
            {t.title}
          </Link>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await saveTask({
                  data: { kind: "status", id: t.id, status: "done" },
                });
                if (!r.ok) setError(r.error);
                else await router.invalidate();
              } catch {
                setError("Action impossible. Réessayez.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Complete
          </Button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      <p className="review-limit">
        Liste actuelle, limitée à 30 éléments. Ouvrez Tasks pour clarifier,
        replanifier ou relancer.
      </p>
    </>
  );
}
function ResetView({ data }: { data: Data }) {
  const [noteDirty, setNoteDirty] = useState(false),
    [prioritiesDirty, setPrioritiesDirty] = useState(false),
    dirty = noteDirty || prioritiesDirty;
  useBlocker({
    shouldBlockFn: () =>
      dirty &&
      !window.confirm("Quitter sans enregistrer les saisies de cette étape ?"),
    enableBeforeUnload: dirty,
  });
  const run = data.run!,
    m = useResetMutation(),
    steps = resetSteps[run.kind],
    title = steps[run.cursor],
    resolved = run.steps.filter(Boolean).length,
    base = { id: run.id, revision: run.revision };
  return (
    <div className="reset-layout">
      <header className="reset-hero">
        <AngelWings />
        <Crystal />
        <p>
          {run.period_start} — {run.period_end}
        </p>
        <h2>{run.completed_at ? "Votre bilan est conservé" : title}</h2>
        <Progress
          label={`${resolved} / ${steps.length} étapes traitées`}
          value={(resolved / steps.length) * 100}
        />
        <nav aria-label="Étapes du Reset">
          {steps.map((label, i) => (
            <span
              key={label}
              aria-current={i === run.cursor ? "step" : undefined}
            >
              {i + 1}. {label}
              {run.steps[i] === "done"
                ? " ✓"
                : run.steps[i] === "skip"
                  ? " · Skip"
                  : ""}
            </span>
          ))}
        </nav>
      </header>
      <section className="review-panel reset-step" aria-label="Étape du Reset">
        <p className="eyebrow">
          Étape {run.cursor + 1} / {steps.length}
        </p>
        <h2>{title}</h2>
        {m.error && <p role="alert">{m.error}</p>}
        {title === "Inbox" && <TaskActions items={data.inbox} view="inbox" />}
        {title === "Overdue" && (
          <TaskActions items={data.overdue} view="overdue" />
        )}
        {title === "Waiting" && (
          <TaskActions items={data.waiting} view="waiting" />
        )}
        {title === "Clean Up" && (
          <>
            <TaskActions items={data.inbox} view="inbox" />
            <Link to="/tasks" search={taskSearch("overdue")}>
              Revoir Overdue
            </Link>
            <Link to="/tasks" search={taskSearch("waiting")}>
              Revoir Waiting
            </Link>
          </>
        )}
        {title === "Projects" && (
          <>
            <p>Progression actuelle et temps suivi sur la période.</p>
            {data.projects
              .filter((p) => p.status === "active" || p.status === "waiting")
              .map((p) => (
                <div className="review-row" key={p.id}>
                  <Link to="/projects/$projectId" params={{ projectId: p.id }}>
                    {p.title}
                  </Link>
                  <span>
                    {p.progress === null
                      ? "Progression non définie"
                      : `${p.progress}%`}{" "}
                    · {time(p.seconds)}
                  </span>
                </div>
              ))}
            <Link to="/projects">Ouvrir Projects</Link>
          </>
        )}
        {title === "Goals" && (
          <>
            <p>Relisez vos objectifs et ajustez-les depuis Life.</p>
            {data.goals.map((g) => (
              <p key={g.id}>
                {g.title} · {g.status}
              </p>
            ))}
            <Link to="/life">Ouvrir Goals dans Life</Link>
          </>
        )}
        {title === "Focus Areas" && (
          <>
            <p>
              Choisissez les domaines auxquels vous souhaitez consacrer votre
              attention. Notez votre intention ci-dessous.
            </p>
            {data.areas
              .filter((a) => !a.is_archived)
              .map((a) => (
                <span className="reset-area" key={a.id}>
                  {a.name}
                </span>
              ))}
            <Link to="/life">Ouvrir Life Areas</Link>
          </>
        )}
        {title === "Habits" && (
          <>
            <p>
              Relisez les habitudes de la période ; ajustez les suivantes depuis
              leur détail.
            </p>
            {data.habits.map((h) => (
              <p key={h.id}>
                {h.title} · {h.done} jours réussis
              </p>
            ))}
            <Link to="/life/habits" search={{ archived: false }}>
              Ouvrir Habits
            </Link>
          </>
        )}
        {(title === "Time Review" || title === "Last Month") && (
          <Insights data={data} compact />
        )}
        {title.includes("Priorities") && (
          <form
            key={run.id + ":priorities"}
            onChange={() => setPrioritiesDirty(true)}
            className="practice-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void m
                .run({
                  kind: "priorities",
                  ...base,
                  values: [0, 1, 2]
                    .map((i) => String(f.get("p" + i) ?? "").trim())
                    .filter(Boolean),
                })
                .then((id) => {
                  if (id) setPrioritiesDirty(false);
                });
            }}
          >
            <p>
              Trois priorités maximum pour garder un cap lisible. Elles ne
              créent pas automatiquement de Tasks.
            </p>
            {[0, 1, 2].map((i) => (
              <Input
                key={i}
                label={`Priorité ${i + 1}`}
                name={"p" + i}
                disabled={m.busy}
                maxLength={300}
                defaultValue={run.priorities[i] ?? ""}
              />
            ))}
            <Button type="submit" disabled={m.busy}>
              Enregistrer les priorités
            </Button>
            <p aria-live="polite">
              {run.priorities.length} priorité(s) enregistrée(s)
            </p>
          </form>
        )}
        {(title === "Plan Next Week" || title === "Month Calendar") && (
          <>
            <p>
              Organisez la prochaine période avec les créneaux et Tasks réels du
              Planner.
            </p>
            <Link
              to="/planner"
              search={{
                day: data.period.next,
                view: run.kind === "weekly" ? "week" : "month",
              }}
            >
              Planifier {data.period.next}
            </Link>
          </>
        )}
        <form
          className="practice-form reset-notes"
          key={run.id + ":" + run.cursor}
          onChange={() => setNoteDirty(true)}
          onSubmit={(e) => {
            e.preventDefault();
            void m
              .run({
                kind: "note",
                ...base,
                text: String(new FormData(e.currentTarget).get("note") ?? ""),
              })
              .then((id) => {
                if (id) setNoteDirty(false);
              });
          }}
        >
          <Textarea
            label="Notes de cette étape"
            disabled={m.busy}
            name="note"
            maxLength={10000}
            defaultValue={run.notes[String(run.cursor)] ?? ""}
          />
          <Button variant="secondary" type="submit" disabled={m.busy}>
            Enregistrer la note
          </Button>
        </form>
        <div className="reset-controls">
          <Button
            variant="secondary"
            disabled={dirty || m.busy || run.cursor === 0}
            onClick={() => void m.run({ kind: "move", ...base, direction: -1 })}
          >
            Previous
          </Button>
          <Button
            disabled={dirty || m.busy}
            onClick={() =>
              void m.run({ kind: "step", ...base, status: "done" })
            }
          >
            Done
          </Button>
          <Button
            variant="ghost"
            disabled={dirty || m.busy}
            onClick={() =>
              void m.run({ kind: "step", ...base, status: "skip" })
            }
          >
            Skip
          </Button>
          <Button
            variant="secondary"
            disabled={dirty || m.busy || run.cursor === steps.length - 1}
            onClick={() => void m.run({ kind: "move", ...base, direction: 1 })}
          >
            Next
          </Button>
        </div>
        <p className="review-limit">
          Enregistrez vos saisies avant de changer d’étape. Next déplace la vue
          ; Done/Skip traite l’étape. Les actions sur Tasks restent
          indépendantes.
        </p>
      </section>
      <Link to="/review" search={{ mode: data.mode, day: data.period.from }}>
        Revenir aux Insights · progression conservée
      </Link>
    </div>
  );
}
