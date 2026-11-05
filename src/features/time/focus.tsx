import {correctedInstant} from "./local-time";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Checkbox,
  Card,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { AngelWings } from "../../design-system/components/ornaments";
import { useTime, StartTimer } from "./provider";
import { actualSeconds, durationLabel } from "./duration";
import { localReminder } from "../tasks/reminder-time";
import { getTask, saveTask } from "../tasks/api";
import type { SessionWithPauses } from "../../types/time";
export function FocusView() {
  const t = useTime(),
    [editing, setEditing] = useState<SessionWithPauses | null | undefined>(
      undefined,
    ),
    s = t.data?.unfinished.find((s) => s.status === "running");
  return (
    <PageLayout
      title="Focus"
      subtitle="Une chose à la fois. Votre temps, conservé."
    >
      <div className="focus-stage">
        <AngelWings />
        {s ? (
          <>
            <h2>{s.title}</h2>
            <p className="focus-clock" aria-label="Temps écoulé">
              {durationLabel(actualSeconds(s, s.pauses, t.now))}
            </p>
            <p>
              {s.target_minutes
                ? `Objectif : ${s.target_minutes} min · ${actualSeconds(s, s.pauses, t.now) >= s.target_minutes * 60 ? "Objectif atteint, terminez à votre rythme." : "À votre rythme."}`
                : "Session libre"}
            </p>
            {s.planned_minutes != null && (
              <p>
                {s.planned_minutes} min prévues ·{" "}
                {Math.floor(actualSeconds(s, s.pauses, t.now) / 60)} min réelles
              </p>
            )}
            <div className="time-actions">
              <Button
                disabled={t.busy}
                onClick={() => void t.command({ kind: "pause", id: s.id })}
              >
                Pause
              </Button>
              <Button
                disabled={t.busy}
                onClick={() => void t.command({ kind: "stop", id: s.id })}
              >
                Finish
              </Button>
            </div>
            {s.task_id && (
              <>
                <Link to="/tasks/$taskId" params={{ taskId: s.task_id }}>
                  Ouvrir la Task
                </Link>
                <FocusChecklist id={s.task_id} />
              </>
            )}
            {s.project_id && (
              <Link
                to="/projects/$projectId"
                params={{ projectId: s.project_id }}
              >
                Ouvrir le Project
              </Link>
            )}
          </>
        ) : (
          <>
            <h2>Un moment pour vous concentrer</h2>
            <StartTimer source={{ kind: "quick" }} label="Quick Timer" />
          </>
        )}
      </div>
      {t.error && <p role="alert">{t.error}</p>}
      <section className="time-list">
        <h2>Sessions en pause</h2>
        {t.data?.unfinished
          .filter((s) => s.status === "paused")
          .map((p) => (
            <Card key={p.id}>
              <strong>{p.title}</strong>
              <span>{durationLabel(actualSeconds(p, p.pauses, t.now))}</span>
              <Button
                disabled={t.busy}
                onClick={() => void t.command({ kind: "resume", id: p.id })}
              >
                Resume
              </Button>
              <Button
                variant="secondary"
                disabled={t.busy}
                onClick={() => void t.command({ kind: "stop", id: p.id })}
              >
                Finish
              </Button>
            </Card>
          ))}
        {!t.data?.unfinished.some((s) => s.status === "paused") && (
          <p>Aucune session en pause.</p>
        )}
        <p>Reprendre met automatiquement en pause la session en cours.</p>
      </section>
      <section className="time-list">
        <div className="time-actions">
          <h2>Historique du temps</h2>
          <Button onClick={() => setEditing(null)}>
            Ajouter du temps manuel
          </Button>
        </div>
        <p>
          {durationLabel(t.data?.today_seconds ?? 0)} suivies aujourd’hui · 50
          dernières sessions
        </p>
        {t.data?.history.map((p) => (
          <Card key={p.id}>
            <div>
              <strong>{p.title}</strong>
              <p>
                {localReminder(p.started_at, t.data!.timezone).replace(
                  "T",
                  " · ",
                )}{" "}
                · {durationLabel(p.actual_duration)}
                {p.planned_minutes != null &&
                  ` / ${p.planned_minutes} min prévues`}
              </p>
            </div>
            <Button variant="secondary" onClick={() => setEditing(p)}>
              Corriger
            </Button>
          </Card>
        ))}
      </section>
      <Sheet
        title="Temps manuel"
        description="Corrigez les horaires et pauses dans le fuseau de votre profil."
        open={editing !== undefined}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
        trigger={<span />}
      >
        {editing !== undefined && t.data && (
          <ManualEditor
            session={editing}
            timezone={t.data.timezone}
            close={() => setEditing(undefined)}
          />
        )}
      </Sheet>
    </PageLayout>
  );
}
function ManualEditor({
  session,
  timezone,
  close,
}: {
  session: SessionWithPauses | null;
  timezone: string;
  close: () => void;
}) {
  const t = useTime(),
    [title, setTitle] = useState(session?.title ?? ""),
    [start, setStart] = useState(
      session ? localReminder(session.started_at, timezone) : "",
    ),
    [end, setEnd] = useState(
      session ? localReminder(session.ended_at!, timezone) : "",
    ),
    [pauses, setPauses] = useState<{start:string;end:string;originalStart?:string;originalEnd?:string}[]>(
      session?.pauses.map((p) => ({
        originalStart: p.started_at, originalEnd: p.ended_at!,
        start: localReminder(p.started_at, timezone),
        end: localReminder(p.ended_at!, timezone),
      })) ?? [],
    ),
    [error, setError] = useState("");
  return (
    <form
      className="time-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const ok = await t.command({
            kind: "manual",
            values: {
              id: session?.id,
              title,
              started_at: correctedInstant(start, timezone, session?.started_at),
              ended_at: correctedInstant(end, timezone, session?.ended_at),
              pauses: pauses.map((p) => ({
                started_at: correctedInstant(p.start, timezone, p.originalStart),
                ended_at: correctedInstant(p.end, timezone, p.originalEnd),
              })),
            },
          });
          if (ok) close();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Horaires invalides.");
        }
      }}
    >
      <p>{timezone}</p>
      <Input
        label="Activité"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <Input
        label="Début"
        type="datetime-local"
        required
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <Input
        label="Fin"
        type="datetime-local"
        required
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <h3>Pauses</h3>
      {pauses.map((p, i) => (
        <fieldset key={i}>
          <legend>Pause {i + 1}</legend>
          <Input
            label="Début de pause"
            type="datetime-local"
            required
            value={p.start}
            onChange={(e) =>
              setPauses((ps) =>
                ps.map((p, j) =>
                  j === i ? { ...p, start: e.target.value } : p,
                ),
              )
            }
          />
          <Input
            label="Fin de pause"
            type="datetime-local"
            required
            value={p.end}
            onChange={(e) =>
              setPauses((ps) =>
                ps.map((p, j) => (j === i ? { ...p, end: e.target.value } : p)),
              )
            }
          />
          <Button
            variant="ghost"
            onClick={() => setPauses((ps) => ps.filter((_, j) => j !== i))}
          >
            Retirer la pause
          </Button>
        </fieldset>
      ))}
      <Button
        variant="secondary"
        onClick={() => setPauses((ps) => [...ps, { start: "", end: "" }])}
      >
        Ajouter une pause
      </Button>
      <Button type="submit" disabled={t.busy}>
        Enregistrer le temps
      </Button>
      {(error || t.error) && <p role="alert">{error || t.error}</p>}
    </form>
  );
}
function FocusChecklist({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getTask>> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void getTask({ data: id })
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        if (live) setError("Checklist indisponible.");
      });
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <div className="focus-checklist">
      {data?.checklist.map((item) => (
        <Checkbox
          key={item.id}
          label={item.label}
          checked={item.is_completed}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            try {
              const result = await saveTask({
                data: {
                  kind: "checklist-update",
                  taskId: id,
                  id: item.id,
                  label: item.label,
                  completed: e.target.checked,
                },
              });
              if (!result.ok) setError(result.error);
              else setData(await getTask({ data: id }));
            } catch {
              setError("Modification impossible.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
