import { occurrenceLanes } from "./layout";
import { useState, type FormEvent, useRef, useEffect } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Select,
  Textarea,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { getPlanner, savePlanner } from "./api";
import {
  addDays,
  weekday,
  localReminder,
  reminderFromLocal,
} from "../../services/planner-rules";
import { calendarDay } from "../../services/task-rules";
import type { Occurrence, PlannerInput, EditScope } from "../../types/planner";
type Data = Awaited<ReturnType<typeof getPlanner>>;
export type PlannerViewName = "week" | "day" | "month" | "agenda";
export function plannerRange(
  day: string,
  view: PlannerViewName,
  weekStart = 1,
) {
  if (view === "day") return { from: day, to: day };
  if (view === "agenda") return { from: day, to: addDays(day, 13) };
  if (view === "month") {
    const first = day.slice(0, 8) + "01",
      from = addDays(first, -((weekday(first) - weekStart + 7) % 7));
    return { from, to: addDays(from, 41) };
  }
  const from = addDays(day, -((weekday(day) - weekStart + 7) % 7));
  return { from, to: addDays(from, 6) };
}
const kinds = {
  event: "Event",
  time_block: "Time Block",
  scheduled_task: "Task planifiée",
};
export function PlannerView({
  data,
  day,
  view,
  onNavigate,
}: {
  data: Data;
  day: string;
  view: PlannerViewName;
  onNavigate: (day: string, view: PlannerViewName) => void;
}) {
  const router = useRouter(),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<Occurrence | null>(null),
    [draft, setDraft] = useState<Partial<PlannerInput>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const gridScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (gridScroll.current) gridScroll.current.scrollTop = 7 * 48;
  }, [day, view]);
  const drag = useRef<{
    item?: Occurrence;
    taskId?: string;
    title?: string;
    resize?: boolean;
  } | null>(null);
  const weekStart = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].indexOf(data.user.week_start);
  const range = plannerRange(day, view, weekStart),
    days = Array.from(
      {
        length:
          view === "day"
            ? 1
            : view === "month"
              ? 42
              : view === "agenda"
                ? 14
                : 7,
      },
      (_, i) => addDays(range.from, i),
    );
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width:900px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  function step(direction: number) {
    if (view === "month") {
      const date = new Date(day + "T12:00:00Z");
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + direction);
      return date.toISOString().slice(0, 10);
    }
    return addDays(
      day,
      direction * (view === "day" ? 1 : view === "agenda" ? 14 : 7),
    );
  }
  const shownDays = mobile && view === "week" ? [day] : days;
  function open(
    values: Partial<PlannerInput> = {},
    item: Occurrence | null = null,
  ) {
    setDraft(values);
    setSelected(item);
    setEditing(true);
  }
  async function move(
    item: Occurrence,
    newDay: string,
    minutes: number,
    resize = false,
  ) {
    const wall =
      newDay +
      "T" +
      String(Math.floor(minutes / 60)).padStart(2, "0") +
      ":" +
      String(minutes % 60).padStart(2, "0");
    let duration: number;
    try {
      duration = resize
        ? Math.round(
            (Date.parse(reminderFromLocal(wall, data.user.timezone)!) -
              Date.parse(item.start)) /
              60000,
          )
        : Math.round((Date.parse(item.end) - Date.parse(item.start)) / 60000);
    } catch {
      setError("Cette heure n’existe pas dans votre fuseau.");
      return;
    }
    const values = {
      ...item.series,
      title: item.title,
      start_local: resize
        ? localReminder(item.start, item.series.timezone)
        : localReminder(
            reminderFromLocal(wall, data.user.timezone)!,
            item.series.timezone,
          ),
      duration_minutes: duration,
    };
    if (item.series.frequency !== "once") {
      open(values, item);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await savePlanner({
        data: {
          kind: "save",
          id: item.series.id,
          key: item.key,
          scope: "occurrence",
          values,
        },
      });
      if (!r.ok) setError(r.error);
      else await router.invalidate();
    } catch {
      setError("Déplacement impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  function drop(event: React.DragEvent, newDay: string, minutes: number) {
    event.preventDefault();
    const payload = drag.current;
    if (!payload || busy) return;
    drag.current = null;
    if (payload.item) void move(payload.item, newDay, minutes, payload.resize);
    else
      open({
        kind: "scheduled_task",
        task_id: payload.taskId,
        title: payload.title,
        start_local:
          newDay +
          "T" +
          String(Math.floor(minutes / 60)).padStart(2, "0") +
          ":" +
          String(minutes % 60).padStart(2, "0"),
      });
  }
  const dayItems = (d: string) =>
    data.items.filter(
      (item) =>
        calendarDay(new Date(item.start), data.user.timezone) <= d &&
        calendarDay(new Date(Date.parse(item.end) - 1), data.user.timezone) >=
          d,
    );
  const clock = (value: string) =>
    localReminder(value, data.user.timezone).slice(11);
  return (
    <div className="planner-page"><PageLayout title="Planner" subtitle="Votre temps, à votre rythme.">
      <div className="planner-toolbar">
        <Button
          variant="secondary"
          onClick={() => onNavigate(step(-1), view)}
          aria-label="Période précédente"
        >
          ←
        </Button>
        <Input
          label="Date du Planner"
          type="date"
          value={day}
          onChange={(e) => e.target.value && onNavigate(e.target.value, view)}
        />
        <Button
          variant="secondary"
          onClick={() => onNavigate(step(1), view)}
          aria-label="Période suivante"
        >
          →
        </Button>
        <Button variant="ghost" onClick={() => onNavigate(data.today, view)}>
          Aujourd’hui
        </Button>
        <Button onClick={() => open({ start_local: day + "T09:00" })}>
          Créer un créneau
        </Button>
      </div>
      <nav className="planner-tabs" aria-label="Vues du Planner">
        {(["day", "week", "month", "agenda"] as const).map((v) => (
          <Button
            key={v}
            variant={view === v ? "primary" : "ghost"}
            aria-current={view === v ? "page" : undefined}
            onClick={() => onNavigate(day, v)}
          >
            {{ day: "Day", week: "Week", month: "Month", agenda: "Agenda" }[v]}
          </Button>
        ))}
      </nav>
      <p className="organization-meta">
        {data.user.timezone} · Event / Time Block / Task planifiée · Les
        créneaux ne changent pas Do Date ou Deadline.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="planner-layout">
        <section className="planner-calendar" aria-label="Calendrier">
          {view === "month" ? (
            <div className="planner-month">
              {days.map((d) => (
                <div key={d} className={d === data.today ? "is-today" : ""}>
                  <Button variant="ghost" onClick={() => onNavigate(d, "day")}>
                    {Number(d.slice(8))}
                  </Button>
                  {dayItems(d)
                    .filter((i) => i.series.kind === "event")
                    .slice(0, 2)
                    .map((i) => (
                      <button
                        key={i.series.id + i.key}
                        onClick={() => open({}, i)}
                      >
                        {i.title}
                      </button>
                    ))}
                  {dayItems(d).length > 0 && (
                    <span>
                      {dayItems(d).length} créneau
                      {dayItems(d).length > 1 ? "x" : ""}
                    </span>
                  )}
                  {data.deadlines
                    .filter((t) => t.deadline === d)
                    .map((t) => (
                      <Link
                        key={t.id}
                        to="/tasks/$taskId"
                        params={{ taskId: t.id }}
                      >
                        Échéance · {t.title}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          ) : view === "agenda" ? (
            <div className="planner-agenda">
              {days.map((d) => (
                <section key={d}>
                  <h2>
                    {new Intl.DateTimeFormat(data.user.locale, {
                      dateStyle: "full",
                      timeZone: "UTC",
                    }).format(new Date(d + "T12:00Z"))}
                  </h2>
                  {dayItems(d).length ? (
                    dayItems(d).map((i) => (
                      <button
                        className={"planner-agenda-item kind-" + i.series.kind}
                        key={i.series.id + i.key}
                        onClick={() => open({}, i)}
                      >
                        <span>
                          {clock(i.start)}–{clock(i.end)} ·{" "}
                          {kinds[i.series.kind]}
                        </span>
                        <strong>{i.title}</strong>
                      </button>
                    ))
                  ) : (
                    <p className="organization-meta">Aucun créneau.</p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <>
              <div
                className="planner-day-head"
                style={{
                  gridTemplateColumns: `48px repeat(${shownDays.length}, minmax(0,1fr))`,
                }}
              >
                <span />
                <>
                  {shownDays.map((d) => (
                    <button key={d} onClick={() => onNavigate(d, "day")}>
                      {new Intl.DateTimeFormat(data.user.locale, {
                        weekday: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(d + "T12:00Z"))}
                    </button>
                  ))}
                </>
              </div>
              <div className="planner-grid-scroll" ref={gridScroll}>
                <div
                  className="planner-time-grid"
                  style={{
                    gridTemplateColumns: `48px repeat(${shownDays.length}, minmax(0,1fr))`,
                  }}
                >
                  <div className="planner-hours">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h}>{String(h).padStart(2, "0")}:00</span>
                    ))}
                  </div>
                  {shownDays.map((d) => (
                    <div className="planner-day" key={d} data-day={d}>
                      {Array.from({ length: 48 }, (_, slot) => (
                        <button
                          className="planner-slot"
                          key={slot}
                          aria-label={`Créer ${d} ${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`}
                          onClick={() =>
                            open({
                              start_local:
                                d +
                                "T" +
                                String(Math.floor(slot / 2)).padStart(2, "0") +
                                ":" +
                                (slot % 2 ? "30" : "00"),
                            })
                          }
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => drop(e, d, slot * 30)}
                        />
                      ))}
                      {dayItems(d).map((i, index) => {
                        const start = localReminder(
                            i.start,
                            data.user.timezone,
                          ),
                          end = localReminder(i.end, data.user.timezone);
                        const top =
                          start.slice(0, 10) < d
                            ? 0
                            : Number(start.slice(11, 13)) * 60 +
                              Number(start.slice(14));
                        const bottom =
                          end.slice(0, 10) > d
                            ? 1440
                            : Number(end.slice(11, 13)) * 60 +
                              Number(end.slice(14));
                        const { lane, columns } = occurrenceLanes(
                          dayItems(d),
                        ).get(i.series.id + i.key)!;
                        return (
                          <div
                            key={i.series.id + i.key}
                            className={"planner-block kind-" + i.series.kind}
                            style={{
                              top: top * 0.8,
                              height: Math.max(24, (bottom - top) * 0.8),
                              left: `${(lane * 100) / columns}%`,
                              width: `${100 / columns}%`,
                              zIndex: index + 2,
                            }}
                            draggable={!busy}
                            onDragStart={() => {
                              drag.current = { item: i };
                            }}
                            onDragEnd={() => {
                              drag.current = null;
                            }}
                          >
                            <button
                              onClick={() => open({}, i)}
                              aria-label={`Modifier ${i.title}`}
                            >
                              <span>
                                {clock(i.start)}–{clock(i.end)} ·{" "}
                                {kinds[i.series.kind]}
                              </span>
                              <strong>{i.title}</strong>
                            </button>
                            <span
                              role="button"
                              tabIndex={0}
                              className="planner-resize"
                              aria-label={`Redimensionner ${i.title}`}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                drag.current = { item: i, resize: true };
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ")
                                  open({}, i);
                              }}
                              onClick={() => open({}, i)}
                            >
                              ↕
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
        <aside className="planner-unscheduled">
          <h2>À planifier</h2>
          <p>Glissez une tâche vers un créneau, ou sélectionnez-la.</p>
          {data.tasks.length ? (
            data.tasks.map((t) => (
              <button
                key={t.id}
                draggable
                onDragStart={() => {
                  drag.current = { taskId: t.id, title: t.title };
                }}
                onDragEnd={() => {
                  drag.current = null;
                }}
                onClick={() =>
                  open({
                    kind: "scheduled_task",
                    task_id: t.id,
                    title: t.title,
                    start_local: day + "T09:00",
                  })
                }
              >
                {t.title}
              </button>
            ))
          ) : (
            <p>Aucune tâche active à positionner.</p>
          )}
          <Link
            to="/tasks"
            search={{ view: "all", q: "", context: "", project: "", area: "" }}
          >
            Toutes les Tasks
          </Link>
        </aside>
      </div>
      <Sheet
        title={selected ? "Modifier le créneau" : "Nouveau créneau"}
        description="Scheduled Time reste indépendant des autres dates."
        open={editing}
        onOpenChange={setEditing}
        trigger={<span />}
      >
        {editing && (
          <PlannerEditor
            data={data}
            item={selected}
            draft={draft}
            onSaved={() => setEditing(false)}
          />
        )}
      </Sheet>
    </PageLayout></div>
  );
}
function PlannerEditor({
  data,
  item,
  draft,
  onSaved,
}: {
  data: Data;
  item: Occurrence | null;
  draft: Partial<PlannerInput>;
  onSaved: () => void;
}) {
  const router = useRouter();
  const base: PlannerInput = item
    ? {
        ...item.series,
        title: item.title,
        start_local: localReminder(item.start, item.series.timezone),
        duration_minutes:
          (Date.parse(item.end) - Date.parse(item.start)) / 60000,
      }
    : {
        kind: "event",
        title: "",
        start_local: data.today + "T09:00",
        duration_minutes: 60,
        timezone: data.user.timezone,
        frequency: "once",
        interval_count: 1,
        weekdays: [],
        until_day: null,
      };
  const [values, setValues] = useState({ ...base, ...draft }),
    [scope, setScope] = useState<EditScope>("occurrence"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const patch = (v: Partial<PlannerInput>) =>
    setValues((prev) => ({ ...prev, ...v }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await savePlanner({
        data: {
          kind: "save",
          id: item?.series.id,
          key: item?.key,
          scope,
          values,
        },
      });
      if (!r.ok) setError(r.error);
      else {
        await router.invalidate();
        onSaved();
      }
    } catch {
      setError("Enregistrement impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const r = await savePlanner({
        data: { kind: "remove", id: item!.series.id, key: item!.key, scope },
      });
      if (!r.ok) setError(r.error);
      else {
        await router.invalidate();
        onSaved();
      }
    } catch {
      setError("Retrait impossible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="organization-form">
      <fieldset disabled={busy}>
        {item?.series.frequency !== "once" && item && (
          <Select
            label="Appliquer à"
            value={scope}
            onChange={(e) => {
              const s = e.target.value as EditScope;
              setScope(s);
              if (s === "series") setValues({ ...item.series });
              else setValues({ ...base, ...draft });
            }}
          >
            <option value="occurrence">Cette occurrence</option>
            <option value="future">Cette occurrence et les suivantes</option>
            <option value="series">Toute la série</option>
          </Select>
        )}
        <Select
          label="Type de créneau"
          disabled={!!item || !!draft.task_id}
          value={values.kind}
          onChange={(e) =>
            patch({ kind: e.target.value as PlannerInput["kind"] })
          }
        >
          <option value="event">Event</option>
          <option value="time_block">Time Block</option>
          <option value="scheduled_task">Task planifiée</option>
        </Select>
        {values.kind === "scheduled_task" && (
          <Select
            label="Task existante"
            value={values.task_id ?? ""}
            disabled={!!item}
            onChange={(e) =>
              patch({
                task_id: e.target.value,
                title:
                  data.tasks.find((t) => t.id === e.target.value)?.title ??
                  values.title,
              })
            }
          >
            <option value="">Choisir une Task</option>
            {item?.series.task_id && (
              <option value={item.series.task_id}>{item.title}</option>
            )}
            {data.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        )}
        <Input
          label="Titre du créneau"
          value={values.title}
          onChange={(e) => patch({ title: e.target.value })}
          required
          maxLength={300}
        />
        <Input
          label={`Début · ${values.timezone}`}
          type="datetime-local"
          value={values.start_local}
          onChange={(e) => patch({ start_local: e.target.value })}
          required
        />
        <Input
          label="Durée en minutes"
          type="number"
          min={1}
          max={10080}
          value={values.duration_minutes}
          onChange={(e) => patch({ duration_minutes: Number(e.target.value) })}
        />
        {values.kind === "event" && (
          <>
            <Input
              label="Lieu"
              disabled={
                !!item &&
                item.series.frequency !== "once" &&
                scope === "occurrence"
              }
              value={values.location ?? ""}
              onChange={(e) => patch({ location: e.target.value })}
            />
            <Textarea
              label="Description"
              disabled={
                !!item &&
                item.series.frequency !== "once" &&
                scope === "occurrence"
              }
              value={values.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </>
        )}
        {(!item ||
          item.series.frequency === "once" ||
          scope !== "occurrence") && (
          <>
            <Select
              label="Répétition"
              value={values.frequency}
              onChange={(e) =>
                patch({
                  frequency: e.target.value as PlannerInput["frequency"],
                })
              }
            >
              <option value="once">Une fois</option>
              <option value="daily">Tous les X jours</option>
              <option value="weekly">Toutes les X semaines</option>
              <option value="monthly">Tous les X mois</option>
            </Select>
            {values.frequency !== "once" && (
              <>
                <Input
                  label="Intervalle"
                  type="number"
                  min={1}
                  max={365}
                  value={values.interval_count}
                  onChange={(e) =>
                    patch({ interval_count: Number(e.target.value) })
                  }
                />
                {values.frequency === "weekly" && (
                  <fieldset>
                    <legend>Jours de la semaine</legend>
                    {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map(
                      (d, i) => (
                        <label key={d}>
                          <input
                            type="checkbox"
                            checked={values.weekdays.includes(i)}
                            onChange={(e) =>
                              patch({
                                weekdays: e.target.checked
                                  ? [...values.weekdays, i]
                                  : values.weekdays.filter((v) => v !== i),
                              })
                            }
                          />
                          {d}{" "}
                        </label>
                      ),
                    )}
                  </fieldset>
                )}
                <Input
                  label="Jusqu’au (facultatif)"
                  type="date"
                  value={values.until_day ?? ""}
                  onChange={(e) => patch({ until_day: e.target.value || null })}
                />
              </>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <Button type="submit" loading={busy}>
          Enregistrer le créneau
        </Button>
        {item && (
          <>
            <p className="organization-meta">
              Retirer ce créneau conserve la Task et ses autres dates. Pour une
              série, la portée choisie s’applique aussi au retrait.
            </p>
            <Button variant="secondary" onClick={() => void remove()}>
              Retirer du Planner
            </Button>
            {item.series.task_id && (
              <Link
                to="/tasks/$taskId"
                params={{ taskId: item.series.task_id }}
              >
                Ouvrir la Task
              </Link>
            )}
          </>
        )}
      </fieldset>
    </form>
  );
}
