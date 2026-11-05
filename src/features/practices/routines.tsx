import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Select,
  Textarea,
  Checkbox,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { StartTimer } from "../time/provider";
import { PracticeNav, usePracticeMutation, type PracticeData } from "./shared";
import type { Routine, RoutineStep, StepInput } from "../../types/practices";
const stepKinds = {
  simple: "Simple",
  checklist: "Checklist",
  task: "Task",
  habit: "Habit",
  timer: "Timer",
};
function RoutineEditor({ routine }: { routine?: Routine }) {
  const [open, setOpen] = useState(false),
    m = usePracticeMutation(),
    nav = useNavigate();
  return (
    <Sheet
      trigger={
        <Button variant={routine ? "ghost" : "primary"}>
          {routine ? "Renommer" : "Nouvelle Routine"}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      title={routine ? "Renommer la routine" : "Nouvelle Routine"}
      description="Un enchaînement simple pour vous accompagner."
    >
      {open && (
        <form
          className="practice-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void m
              .run({
                kind: "routine-save",
                id: routine?.id,
                title: String(f.get("title")),
              })
              .then((id) => {
                if (id) {
                  setOpen(false);
                  void nav({
                    to: "/routines",
                    search: { archived: false, routineId: id },
                  });
                }
              });
          }}
        >
          <Input
            label="Titre"
            name="title"
            required
            maxLength={300}
            defaultValue={routine?.title}
          />
          {m.error && <p role="alert">{m.error}</p>}
          <Button type="submit" loading={m.busy}>
            Enregistrer
          </Button>
        </form>
      )}
    </Sheet>
  );
}
function StepEditor({
  data,
  step,
}: {
  data: PracticeData;
  step?: RoutineStep;
}) {
  const [open, setOpen] = useState(false),
    m = usePracticeMutation();
  if (!data.routine) return null;
  return (
    <Sheet
      trigger={
        <Button variant={step ? "ghost" : "secondary"}>
          {step ? "Modifier" : "Ajouter une étape"}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      title={step ? "Modifier l’étape" : "Nouvelle étape"}
      description="Les modifications concernent les prochains passages. Un passage commencé conserve ses étapes."
    >
      {open && (
        <StepForm
          data={data}
          step={step}
          busy={m.busy}
          error={m.error}
          save={async (values) => {
            if (
              await m.run({
                kind: "step-save",
                routineId: data.routine!.id,
                id: step?.id,
                values,
              })
            )
              setOpen(false);
          }}
        />
      )}
    </Sheet>
  );
}
function StepForm({
  data,
  step,
  busy,
  error,
  save,
}: {
  data: PracticeData;
  step?: RoutineStep;
  busy: boolean;
  error: string;
  save: (v: StepInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<StepInput["kind"]>(step?.kind ?? "simple");
  return (
    <form
      className="practice-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void save({
          title: String(f.get("title")),
          kind,
          checklist: String(f.get("checklist") ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          task_id: String(f.get("task") ?? "") || null,
          habit_id: String(f.get("habit") ?? "") || null,
          target_minutes: f.get("minutes") ? Number(f.get("minutes")) : null,
        });
      }}
    >
      <Input
        label="Titre de l’étape"
        name="title"
        required
        maxLength={300}
        defaultValue={step?.title}
      />
      <Select
        label="Type d’étape"
        value={kind}
        onChange={(e) => setKind(e.target.value as StepInput["kind"])}
      >
        {Object.entries(stepKinds).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      {kind === "checklist" && (
        <Textarea
          label="Checklist · une ligne par élément"
          name="checklist"
          required
          defaultValue={step?.checklist.join("\n")}
        />
      )}{" "}
      {kind === "task" && (
        <Select
          label="Task liée"
          name="task"
          required
          defaultValue={step?.task_id ?? ""}
        >
          <option value="">Choisir</option>
          {data.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      )}
      {kind === "habit" && (
        <Select
          label="Habit liée"
          name="habit"
          required
          defaultValue={step?.habit_id ?? ""}
        >
          <option value="">Choisir</option>
          {data.habits.map((h) => (
            <option key={h.habit.id} value={h.habit.id}>
              {h.habit.title}
            </option>
          ))}
        </Select>
      )}
      {kind === "timer" && (
        <Input
          label="Durée indicative en minutes"
          name="minutes"
          type="number"
          min={1}
          max={10080}
          defaultValue={step?.target_minutes ?? 25}
        />
      )}{" "}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>
        Enregistrer l’étape
      </Button>
    </form>
  );
}
export function RoutinesView({
  data,
  archived,
}: {
  data: PracticeData;
  archived: boolean;
}) {
  const m = usePracticeMutation(),
    nav = useNavigate(),
    run = data.run,
    step = run ? data.runSteps[run.current_step] : null;
  return (
    <PageLayout
      title="Routines"
      subtitle="Un pas après l’autre, dans votre propre rythme."
    >
      <PracticeNav />
      <div className="practice-toolbar">
        <RoutineEditor />
        <Link to="/routines" search={{ archived: !archived }}>
          {archived ? "Actives" : "Archives"}
        </Link>
      </div>
      {m.error && <p role="alert">{m.error}</p>}
      {run && step && (
        <section
          className="practice-card practice-run"
          aria-label="Passage guidé"
        >
          <p className="eyebrow">
            {run.status === "completed"
              ? "Passage terminé"
              : "Passage en cours"}{" "}
            · {run.title}
          </p>
          <p>
            Étape {run.current_step + 1} / {data.runSteps.length} ·{" "}
            {data.runSteps.filter((s) => s.status === "pending").length}{" "}
            restante(s)
          </p>
          <h2>{step.title}</h2>
          <p>
            {stepKinds[step.kind]} ·{" "}
            {step.status === "pending"
              ? "À faire"
              : step.status === "done"
                ? "Done"
                : "Skip"}
          </p>
          {step.kind === "checklist" && (
            <RunChecklist
              key={step.id + JSON.stringify(step.checks)}
              labels={step.checklist}
              checks={step.checks}
              disabled={
                m.busy ||
                step.status !== "pending" ||
                run.status === "completed"
              }
              change={async (index, checked) =>
                !!(await m.run({
                  kind: "run-check",
                  id: run.id,
                  stepId: step.id,
                  index,
                  checked,
                }))
              }
            />
          )}
          {step.kind === "task" && (
            <p className="practice-hint">
              Done terminera la Task liée. Skip la laissera inchangée.
            </p>
          )}
          {step.kind === "habit" && (
            <p className="practice-hint">
              Done renseignera l’objectif de la Habit pour aujourd’hui.
            </p>
          )}
          {step.kind === "timer" && (
            <>
              <p>
                {step.target_minutes
                  ? `${step.target_minutes} min indicatives`
                  : "Durée libre"}
                . La fin reste explicite.
              </p>
              {run.status === "running" && step.status === "pending" && (
                <StartTimer
                  source={{ kind: "routine", id: run.id, key: step.id }}
                  label="Timer de l’étape"
                />
              )}
              <p className="practice-hint">
                Finish &amp; Done termine les sessions de cette étape, y compris
                celles en pause. Skip les conserve : vous pourrez les terminer
                depuis Focus.
              </p>
            </>
          )}
          <div className="practice-actions">
            <Button
              variant="secondary"
              disabled={m.busy || run.current_step === 0}
              onClick={() =>
                void m.run({ kind: "run-move", id: run.id, direction: -1 })
              }
            >
              Previous
            </Button>
            {run.status === "running" && step.status === "pending" && (
              <>
                <Button
                  disabled={m.busy}
                  onClick={() =>
                    void m.run({
                      kind: "run-step",
                      id: run.id,
                      stepId: step.id,
                      status: "done",
                    })
                  }
                >
                  {step.kind === "timer" ? "Finish & Done" : "Done"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={m.busy}
                  onClick={() =>
                    void m.run({
                      kind: "run-step",
                      id: run.id,
                      stepId: step.id,
                      status: "skip",
                    })
                  }
                >
                  Skip
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              disabled={m.busy || run.current_step === data.runSteps.length - 1}
              onClick={() =>
                void m.run({ kind: "run-move", id: run.id, direction: 1 })
              }
            >
              Next
            </Button>
          </div>
          {run.status === "running" && (
            <div className="practice-actions">
              <StartTimer
                source={{ kind: "routine", id: run.id }}
                label="Timer global facultatif"
              />
              <span className="practice-hint">
                Indépendant du passage. À terminer explicitement dans Focus.
              </span>
            </div>
          )}
          <Link to="/routines" search={{ archived: false }}>
            Quitter la vue guidée · progression conservée
          </Link>
        </section>
      )}
      {data.routine && !run && (
        <section
          className="practice-card practice-run"
          aria-label="Étapes de la routine"
        >
          <h2>{data.routine.title}</h2>
          <div className="practice-actions">
            <RoutineEditor routine={data.routine} />
            {!data.routine.archived && (
              <>
                <StepEditor data={data} />
                <Button
                  disabled={m.busy || !data.steps.length}
                  onClick={() =>
                    void m
                      .run({ kind: "run-start", routineId: data.routine!.id })
                      .then((id) => {
                        if (id)
                          void nav({
                            to: "/routines",
                            search: { archived: false, runId: id },
                          });
                      })
                  }
                >
                  Commencer la routine
                </Button>
              </>
            )}
          </div>
          <ol className="practice-steps">
            {data.steps.map((s, i) => (
              <li key={s.id}>
                <strong>
                  {i + 1}. {s.title}
                </strong>{" "}
                · {stepKinds[s.kind]}
                {!data.routine!.archived && (
                  <div className="practice-actions">
                    <StepEditor data={data} step={s} />
                    <Button
                      variant="ghost"
                      aria-label={`Monter ${s.title}`}
                      disabled={m.busy || i === 0}
                      onClick={() =>
                        void m.run({
                          kind: "step-move",
                          routineId: s.routine_id,
                          id: s.id,
                          direction: -1,
                        })
                      }
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`Descendre ${s.title}`}
                      disabled={m.busy || i === data.steps.length - 1}
                      onClick={() =>
                        void m.run({
                          kind: "step-move",
                          routineId: s.routine_id,
                          id: s.id,
                          direction: 1,
                        })
                      }
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={m.busy}
                      onClick={() =>
                        void m.run({
                          kind: "step-remove",
                          routineId: s.routine_id,
                          id: s.id,
                        })
                      }
                    >
                      Retirer
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {!data.steps.length && <p>Ajoutez votre première étape.</p>}
        </section>
      )}
      <div
        className={run ? "practice-grid routine-secondary" : "practice-grid"}
      >
        {data.routines.map((r) => (
          <article key={r.id} className="practice-card">
            <h2>
              <Link to="/routines" search={{ archived, routineId: r.id }}>
                {r.title}
              </Link>
            </h2>
            <div className="practice-actions">
              <Link to="/routines" search={{ archived, routineId: r.id }}>
                Voir les étapes
              </Link>
              <Button
                variant="ghost"
                disabled={m.busy}
                onClick={() =>
                  void m.run({
                    kind: "archive",
                    type: "routine",
                    id: r.id,
                    archived: !archived,
                  })
                }
              >
                {archived ? "Restaurer" : "Archiver"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!data.routines.length && (
        <div className="practice-empty">
          Aucune Routine. Assemblez des étapes simples, checklists, Tasks,
          Habits ou Timers.
        </div>
      )}
      {data.runs.length > 0 && (
        <section className="practice-card practice-run routine-history">
          <h2>Passages conservés</h2>
          <ul className="practice-log">
            {data.runs.map((r) => (
              <li key={r.id}>
                <Link to="/routines" search={{ archived: false, runId: r.id }}>
                  {r.title} · {r.started_at.slice(0, 10)} ·{" "}
                  {r.status === "running" ? "En cours" : "Terminé"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageLayout>
  );
}

function RunChecklist({
  labels,
  checks,
  disabled,
  change,
}: {
  labels: string[];
  checks: boolean[];
  disabled: boolean;
  change: (index: number, checked: boolean) => Promise<boolean>;
}) {
  const [local, setLocal] = useState(checks);
  return (
    <div className="practice-form">
      {labels.map((label, i) => (
        <Checkbox
          key={i}
          label={label}
          checked={local[i]}
          disabled={disabled}
          onChange={(e) => {
            const checked = e.target.checked;
            setLocal(local.map((v, j) => (j === i ? checked : v)));
            void change(i, checked).then((ok) => {
              if (!ok) setLocal(checks);
            });
          }}
        />
      ))}
    </div>
  );
}
