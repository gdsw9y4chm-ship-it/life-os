import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { PageLayout } from "../../components/layout/page-shell";
import {
  Button,
  Progress,
  Input,
  Select,
  Textarea,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
import {
  PracticeNav,
  usePracticeMutation,
  round,
  type PracticeData,
} from "./shared";
import type { Tracker, TrackerInput } from "../../types/practices";
const kinds = {
  number: "Number",
  duration: "Duration",
  counter: "Counter",
  boolean: "Boolean",
  scale: "Scale",
};
const frequencies = {
  daily: "Chaque jour",
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
};
export function TrackerEditor({ tracker }: { tracker?: Tracker }) {
  const [open, setOpen] = useState(false),
    m = usePracticeMutation();
  return (
    <Sheet
      trigger={
        <Button variant={tracker ? "ghost" : "primary"}>
          {tracker ? "Modifier" : "Nouveau Tracker"}
        </Button>
      }
      open={open}
      onOpenChange={setOpen}
      title={tracker ? "Modifier le Tracker" : "Nouveau Tracker"}
      description="Choisissez ce que vous souhaitez observer, sans suivi imposé."
    >
      {open && (
        <TrackerForm
          tracker={tracker}
          busy={m.busy}
          error={m.error}
          save={async (values) => {
            if (await m.run({ kind: "tracker-save", id: tracker?.id, values }))
              setOpen(false);
          }}
        />
      )}
    </Sheet>
  );
}
function TrackerForm({
  tracker,
  busy,
  error,
  save,
}: {
  tracker?: Tracker;
  busy: boolean;
  error: string;
  save: (v: TrackerInput) => Promise<void>;
}) {
  const [v, set] = useState<TrackerInput>(
    tracker ?? {
      title: "",
      kind: "number",
      unit: "",
      target: null,
      frequency: "daily",
      scale_min: 0,
      scale_max: 10,
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
        label="Type"
        disabled={!!tracker}
        value={v.kind}
        onChange={(e) =>
          set({
            ...v,
            kind: e.target.value as TrackerInput["kind"],
            unit: e.target.value === "duration" ? "min" : "",
          })
        }
      >
        {Object.entries(kinds).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      <Input
        label="Unité"
        disabled={!!tracker || v.kind === "duration"}
        maxLength={40}
        value={v.unit}
        onChange={(e) => set({ ...v, unit: e.target.value })}
      />
      {v.kind === "scale" && (
        <>
          <Input
            label="Minimum"
            type="number"
            step="any"
            disabled={!!tracker}
            value={v.scale_min}
            onChange={(e) => set({ ...v, scale_min: Number(e.target.value) })}
          />
          <Input
            label="Maximum"
            type="number"
            step="any"
            disabled={!!tracker}
            value={v.scale_max}
            onChange={(e) => set({ ...v, scale_max: Number(e.target.value) })}
          />
        </>
      )}
      <Input
        label="Cible facultative"
        type="number"
        step="any"
        value={v.target ?? ""}
        onChange={(e) =>
          set({
            ...v,
            target: e.target.value === "" ? null : Number(e.target.value),
          })
        }
      />
      <Select
        label="Fréquence d’observation"
        value={v.frequency}
        onChange={(e) =>
          set({ ...v, frequency: e.target.value as TrackerInput["frequency"] })
        }
      >
        {Object.entries(frequencies).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </Select>
      {tracker && (
        <p className="practice-hint">
          Le type, l’unité et les limites de l’échelle restent fixes pour
          préserver la lecture de l’historique.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" loading={busy}>
        Enregistrer
      </Button>
    </form>
  );
}
export function TrackersView({
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
      title="Trackers"
      subtitle="Des repères personnels, uniquement ceux qui vous sont utiles."
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
                to: "/life/trackers",
                search: { day: e.target.value, archived },
              });
          }}
        />
        <TrackerEditor />
        <Link to="/life/trackers" search={{ archived: !archived }}>
          {archived ? "Actifs" : "Archives"}
        </Link>
      </div>
      {m.error && <p role="alert">{m.error}</p>}
      {!data.trackers.length && (
        <div className="practice-empty">
          Aucun Tracker. Ajoutez un repère personnel : quantité, durée,
          compteur, oui/non ou échelle.
        </div>
      )}
      <div className="practice-grid tracker-dashboard">
        {data.trackers.map((t) => {
          const history = data.entries.filter((e) => e.tracker_id === t.id),
            entry = history.find((e) => e.day === data.day);
          return (
            <article className="practice-card" aria-label={t.title} key={t.id}>
              <p className="eyebrow">
                {kinds[t.kind]} · {frequencies[t.frequency]}
              </p>
              <h2>{t.title}</h2>
              <p className="practice-total">
                {entry
                  ? t.kind === "boolean"
                    ? entry.value
                      ? "Oui"
                      : "Non"
                    : round(entry.value)
                  : "—"}{" "}
                <small>{t.unit}</small>
              </p>
              {t.target !== null && (
                <p>
                  Cible : {t.target} {t.unit}
                </p>
              )}
              {t.target !== null && t.target > 0 && (
                <Progress
                  label={`Progression de ${t.title}`}
                  value={Math.min(100, ((entry?.value ?? 0) / t.target) * 100)}
                />
              )}
              {!archived && t.kind === "counter" && (
                <Button
                  variant="secondary"
                  disabled={m.busy}
                  onClick={() =>
                    void m.run({
                      kind: "tracker-entry",
                      id: t.id,
                      day: data.day,
                      value: 1,
                      note: entry?.note,
                      increment: true,
                    })
                  }
                >
                  +1
                </Button>
              )}
              <details className="practice-detail">
                <summary>Détails de {t.title}</summary>
                {!archived && (
                  <>
                    <form
                      key={`${t.id}-${data.day}-${entry?.updated_at}`}
                      className="practice-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void m.run({
                          kind: "tracker-entry",
                          id: t.id,
                          day: data.day,
                          value: Number(f.get("value")),
                          note: String(f.get("note") ?? ""),
                        });
                      }}
                    >
                      {t.kind === "boolean" ? (
                        <Select
                          label="Valeur du jour"
                          name="value"
                          defaultValue={String(entry?.value ?? 1)}
                        >
                          <option value="1">Oui</option>
                          <option value="0">Non</option>
                        </Select>
                      ) : (
                        <Input
                          label={`Valeur du jour ${t.unit}`}
                          name="value"
                          type="number"
                          step="any"
                          min={
                            t.kind === "scale"
                              ? t.scale_min
                              : ["counter", "duration"].includes(t.kind)
                                ? 0
                                : undefined
                          }
                          max={t.kind === "scale" ? t.scale_max : 1000000000}
                          required
                          defaultValue={
                            entry?.value ??
                            (t.kind === "scale" ? t.scale_min : 0)
                          }
                        />
                      )}
                      <Textarea
                        label="Note du jour"
                        name="note"
                        maxLength={10000}
                        defaultValue={entry?.note ?? ""}
                      />
                      <div className="practice-actions">
                        <Button type="submit" loading={m.busy}>
                          Enregistrer la valeur
                        </Button>
                      </div>
                    </form>
                    <TrackerEditor tracker={t} />
                  </>
                )}
                <Button
                  variant="ghost"
                  disabled={m.busy}
                  onClick={() =>
                    void m.run({
                      kind: "archive",
                      type: "tracker",
                      id: t.id,
                      archived: !archived,
                    })
                  }
                >
                  {archived ? "Restaurer" : "Archiver"}
                </Button>
                <details>
                  <summary>
                    Historique · {history.length} valeur(s) sur 90 jours
                  </summary>
                  <ul className="practice-log">
                    {history.map((e) => (
                      <li key={e.day}>
                        <strong>{e.day}</strong> ·{" "}
                        {t.kind === "boolean"
                          ? e.value
                            ? "Oui"
                            : "Non"
                          : round(e.value)}{" "}
                        {t.unit}
                        {e.note && <p>{e.note}</p>}
                      </li>
                    ))}
                  </ul>
                </details>
              </details>
            </article>
          );
        })}
      </div>
    </PageLayout>
  );
}
