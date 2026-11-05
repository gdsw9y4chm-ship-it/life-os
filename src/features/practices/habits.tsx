import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Input,
  Select,
  Checkbox,
  Textarea,
  Progress,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import { StartTimer } from "../time/provider";
import {
  PracticeNav,
  usePracticeMutation,
  dayStates,
  round,
  type PracticeData,
} from "./shared";
import type {
  HabitInput,
  HabitSummary,
  HabitEntry,
} from "../../types/practices";
const weekdays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export function HabitEditor({
  data,
  habit,
  onCreated,
}: {
  data: PracticeData;
  habit?: HabitSummary;
  onCreated?: () => void;
}) {
  const [open, setOpen] = useState(false),
    m = usePracticeMutation();
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant={habit ? "ghost" : "primary"}>
          {habit ? "Modifier" : "Nouvelle Habit"}
        </Button>
      }
      title={habit ? "Modifier la Habit" : "Nouvelle Habit"}
      description="Une intention régulière, à votre rythme."
    >
      {open && (
        <HabitForm
          key={habit?.habit.id ?? "new"}
          data={data}
          habit={habit}
          busy={m.busy}
          error={m.error}
          save={async (values) => {
            if (
              await m.run({ kind: "habit-save", id: habit?.habit.id, values })
            ) {
              setOpen(false);
              onCreated?.();
            }
          }}
        />
      )}
    </Sheet>
  );
}
function HabitForm({
  data,
  habit,
  busy,
  error,
  save,
}: {
  data: PracticeData;
  habit?: HabitSummary;
  busy: boolean;
  error: string;
  save: (v: HabitInput) => Promise<void>;
}) {
  const [v, set] = useState<HabitInput>(
    habit
      ? {
          ...habit.rule,
          title: habit.habit.title,
          life_area_id: habit.habit.life_area_id,
          start_day: habit.rule.effective_from,
        }
      : {
          title: "",
          life_area_id: null,
          start_day: data.today,
          frequency: "days",
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          every_days: 2,
          quota: 3,
          target_kind: "count",
          target: 1,
          unit: "",
        },
  );
  return (
    <form
      className="practice-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(v);
      }}
    >
      <Input
        label="Titre"
        required
        maxLength={300}
        value={v.title}
        onChange={(e) => set({ ...v, title: e.target.value })}
      />
      <Select
        label="Life Area"
        disabled={!!habit}
        value={v.life_area_id ?? ""}
        onChange={(e) => set({ ...v, life_area_id: e.target.value || null })}
      >
        <option value="">Aucune</option>
        {data.areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      {!habit && (
        <Input
          label="Début"
          type="date"
          required
          max={data.today}
          value={v.start_day}
          onChange={(e) => set({ ...v, start_day: e.target.value })}
        />
      )}
      <Select
        label="Fréquence"
        value={v.frequency}
        onChange={(e) =>
          set({ ...v, frequency: e.target.value as HabitInput["frequency"] })
        }
      >
        <option value="days">Jours précis</option>
        <option value="weekly">X fois par semaine</option>
        <option value="monthly">X fois par mois</option>
        <option value="interval">Tous les X jours</option>
      </Select>
      {v.frequency === "days" && (
        <fieldset className="practice-weekdays">
          <legend>Jours</legend>
          {weekdays.map((d, i) => (
            <Checkbox
              key={d}
              label={d}
              checked={v.weekdays.includes(i)}
              onChange={(e) =>
                set({
                  ...v,
                  weekdays: e.target.checked
                    ? [...v.weekdays, i]
                    : v.weekdays.filter((n) => n !== i),
                })
              }
            />
          ))}
        </fieldset>
      )}
      {["weekly", "monthly"].includes(v.frequency) && (
        <Input
          label="Jours réussis par période"
          type="number"
          min={1}
          max={v.frequency === "weekly" ? 7 : 31}
          required
          value={v.quota}
          onChange={(e) => set({ ...v, quota: Number(e.target.value) })}
        />
      )}{" "}
      {v.frequency === "interval" && (
        <Input
          label="Intervalle en jours"
          type="number"
          min={1}
          max={365}
          required
          value={v.every_days}
          onChange={(e) => set({ ...v, every_days: Number(e.target.value) })}
        />
      )}
      <Select
        label="Objectif"
        value={v.target_kind}
        onChange={(e) =>
          set({
            ...v,
            target_kind: e.target.value as HabitInput["target_kind"],
            target: 1,
            unit: e.target.value === "duration" ? "min" : "",
          })
        }
      >
        <option value="count">Une réalisation</option>
        <option value="quantity">Quantité</option>
        <option value="duration">Durée</option>
      </Select>
      {v.target_kind !== "count" && (
        <>
          <Input
            label={
              v.target_kind === "duration"
                ? "Minutes par jour réussi"
                : "Quantité par jour réussi"
            }
            type="number"
            step="any"
            min={0.01}
            max={1000000}
            required
            value={v.target}
            onChange={(e) => set({ ...v, target: Number(e.target.value) })}
          />
          {v.target_kind === "quantity" && (
            <Input
              label="Unité"
              maxLength={40}
              value={v.unit}
              onChange={(e) => set({ ...v, unit: e.target.value })}
            />
          )}
        </>
      )}
      {habit && (
        <p className="practice-hint">
          La nouvelle règle s’applique à partir d’aujourd’hui. Les règles
          antérieures restent conservées.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>
        Enregistrer
      </Button>
    </form>
  );
}
function HabitLog({ h, data }: { h: HabitSummary; data: PracticeData }) {
  const [open, setOpen] = useState(false),
    m = usePracticeMutation();
  return (
    <Sheet
      trigger={<Button variant="secondary">Renseigner</Button>}
      open={open}
      onOpenChange={setOpen}
      title={h.habit.title}
      description="Valeur manuelle du jour. Le temps terminé avec le Timer s’ajoute automatiquement."
    >
      {open && (
        <form
          className="practice-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void m
              .run({
                kind: "habit-log",
                id: h.habit.id,
                day: data.day,
                status: f.get("status") as HabitEntry["status"],
                value: Number(f.get("value")),
                note: String(f.get("note") ?? ""),
              })
              .then((id) => {
                if (id) setOpen(false);
              });
          }}
        >
          <p>
            {data.day} · Timer : {round(h.day.timer_minutes)} min
          </p>
          <Select label="État" name="status" defaultValue="done">
            <option value="done">Done</option>
            <option value="progress">En cours</option>
            <option value="skip">Skip</option>
            <option value="missed">Missed</option>
          </Select>
          <Input
            label={`Valeur manuelle ${h.rule.unit}`}
            name="value"
            type="number"
            min={0}
            step="any"
            required
            defaultValue={Math.max(0, h.day.value - h.day.timer_minutes)}
          />
          <Textarea
            name="note"
            label="Note"
            maxLength={10000}
            defaultValue={h.day.note}
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
export function HabitsView({
  data,
  archived,
}: {
  data: PracticeData;
  archived: boolean;
}) {
  const nav = useNavigate(),
    m = usePracticeMutation();
  return (
    <PageLayout
      title="Habits"
      subtitle="De petites intentions, sans pression inutile."
    >
      <PracticeNav />
      <div className="practice-toolbar">
        <Input
          label="Jour observé"
          type="date"
          max={data.today}
          value={data.day}
          onChange={(e) => {
            if (e.target.value)
              void nav({
                to: "/life/habits",
                search: { day: e.target.value, archived },
              });
          }}
        />
        <HabitEditor data={data} />
        <Link to="/life/habits" search={{ archived: !archived }}>
          {archived ? "Actives" : "Archives"}
        </Link>
      </div>
      {m.error && <p role="alert">{m.error}</p>}
      {!data.habits.length && (
        <div className="practice-empty">
          Aucune Habit pour cette date. Créez votre première intention.
        </div>
      )}
      <div className="practice-grid habit-dashboard">
        {data.habits.map((h) => (
          <article
            className="practice-card"
            key={h.habit.id}
            aria-label={h.habit.title}
          >
            <p className="eyebrow">
              {h.rule.frequency === "weekly"
                ? "Cette semaine"
                : h.rule.frequency === "monthly"
                  ? "Ce mois"
                  : data.day}
            </p>
            <h2>{h.habit.title}</h2>
            {["weekly", "monthly"].includes(h.rule.frequency) && (
              <>
                <strong className="practice-total">
                  {h.period.completed} / {h.period.target}
                </strong>
                <span>
                  {" "}
                  jours réussis ·{" "}
                  {h.period.state === "paused"
                    ? "En pause"
                    : dayStates[h.period.state]}
                </span>
              </>
            )}
            <p>
              <span className={`practice-state state-${h.day.state}`}>
                {dayStates[h.day.state]}
              </span>{" "}
              · {round(h.day.value)} / {h.rule.target} {h.rule.unit}
            </p>
            <Progress
              value={Math.min(100, (h.day.value / h.rule.target) * 100)}
              label={`Progression de ${h.habit.title}`}
            />
            {!archived && (
              <div className="practice-actions">
                <Button
                  disabled={
                    m.busy ||
                    h.day.state === "done" ||
                    h.day.state === "paused" ||
                    h.day.state === "off"
                  }
                  onClick={() =>
                    void m.run({
                      kind: "habit-log",
                      id: h.habit.id,
                      day: data.day,
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
              </div>
            )}
            <details className="practice-detail">
              <summary>Détails de {h.habit.title}</summary>{" "}
              <div
                className="practice-history"
                aria-label="Historique sur 14 jours"
              >
                {h.history.map((d) => (
                  <button
                    key={d.day}
                    type="button"
                    className={`state-${d.state}`}
                    aria-label={`${d.day} : ${dayStates[d.state]}`}
                    title={`${d.day} : ${dayStates[d.state]}`}
                    onClick={() =>
                      void nav({
                        to: "/life/habits",
                        search: { day: d.day, archived },
                      })
                    }
                  >
                    {Number(d.day.slice(-2))}
                  </button>
                ))}
              </div>
              {!archived && (
                <div className="practice-actions">
                  {" "}
                  <Button
                    variant="ghost"
                    disabled={m.busy}
                    onClick={() =>
                      void m.run({
                        kind: "habit-log",
                        id: h.habit.id,
                        day: data.day,
                        status: "skip",
                        value: 0,
                      })
                    }
                  >
                    Skip
                  </Button>
                  <HabitLog h={h} data={data} />
                  {h.rule.target_kind === "duration" && !h.paused && (
                    <StartTimer
                      source={{ kind: "habit", id: h.habit.id }}
                      label="Timer Habit"
                    />
                  )}
                </div>
              )}
              <div className="practice-actions">
                {!archived && (
                  <>
                    <HabitEditor data={data} habit={h} />
                    <Button
                      variant="ghost"
                      disabled={m.busy}
                      onClick={() =>
                        void m.run({
                          kind: "habit-pause",
                          id: h.habit.id,
                          paused: !h.paused,
                        })
                      }
                    >
                      {h.paused ? "Reprendre la Habit" : "Mettre en pause"}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  disabled={m.busy}
                  onClick={() =>
                    void m.run({
                      kind: "archive",
                      type: "habit",
                      id: h.habit.id,
                      archived: !archived,
                    })
                  }
                >
                  {archived ? "Restaurer" : "Archiver"}
                </Button>
              </div>
            </details>
          </article>
        ))}
      </div>
    </PageLayout>
  );
}
