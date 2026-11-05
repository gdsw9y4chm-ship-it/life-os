import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { getTime, saveTime } from "./api";
import type { TimeCommand, TimeSource } from "../../types/time";
import { actualSeconds, durationLabel } from "./duration";
import {
  Button,
  Input,
  Select,
} from "../../design-system/components/primitives";
import { Sheet } from "../../design-system/components/overlays";
type Snapshot = Awaited<ReturnType<typeof getTime>>;
const Context = createContext<{
  data: Snapshot | null;
  now: string;
  busy: boolean;
  error: string;
  command: (v: TimeCommand) => Promise<boolean>;
  start: (source: TimeSource) => void;
} | null>(null);
export function useTime() {
  const value = useContext(Context);
  if (!value) throw new Error("Timer provider absent");
  return value;
}
export function TimeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [now, setNow] = useState(new Date().toISOString()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [source, setSource] = useState<TimeSource | null>(null),
    [title, setTitle] = useState(""),
    [target, setTarget] = useState("");
  const router = useRouter(),
    lock = useRef(false),
    offset = useRef(0),
    version = useRef(0);
  const refresh = useCallback(async () => {
    const n = ++version.current;
    try {
      const d = await getTime();
      if (n !== version.current) return;
      offset.current = Date.parse(d.now) - Date.now();
      setNow(d.now);
      setData(d);
    } catch {
      setError(
        "Impossible de charger le Timer. Réessayez en revenant dans cet onglet.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const tick = setInterval(
        () => setNow(new Date(Date.now() + offset.current).toISOString()),
        1000,
      ),
      poll = setInterval(() => void refresh(), 30000);
    const wake = () => void refresh();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [refresh]);
  async function command(v: TimeCommand) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await saveTime({ data: v });
      if (!r.ok) {
        setError(r.error);
        return false;
      }
      await refresh();
      await router.invalidate();
      return true;
    } catch {
      setError("Enregistrement impossible. Votre session reste conservée.");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const running = data?.unfinished.find((s) => s.status === "running");
  async function submit(conflict: "cancel" | "pause" | "stop") {
    if (
      source &&
      (await command({
        kind: "start",
        values: {
          source,
          title,
          target_minutes: target ? Number(target) : null,
          conflict,
        },
      }))
    )
      setSource(null);
  }
  return (
    <Context.Provider
      value={{
        data,
        now,
        busy,
        error,
        command,
        start: (s) => {
          setTitle("");
          setTarget("");
          setSource(s);
        },
      }}
    >
      {children}
      <Sheet
        title="Démarrer une session"
        description="Votre temps reste enregistré après navigation ou fermeture."
        open={!!source}
        onOpenChange={(v) => {
          if (!v) setSource(null);
        }}
        trigger={<span />}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit("cancel");
          }}
          className="time-form"
        >
          <Input
            label="Activité (facultatif pour une source liée)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Session libre"
          />
          <Select
            label="Objectif de session"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Libre</option>
            {[25, 45, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </Select>
          {running ? (
            <>
              <p>
                <strong>{running.title}</strong> est en cours. Choisissez
                comment la conserver avant de démarrer.
              </p>
              <Button disabled={busy} onClick={() => void submit("pause")}>
                Pause & Start
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void submit("stop")}
              >
                Stop & Start
              </Button>
            </>
          ) : (
            <Button type="submit" disabled={busy || !data}>
              Start
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSource(null)}>
            Cancel
          </Button>
          {error && <p role="alert">{error}</p>}
        </form>
      </Sheet>
    </Context.Provider>
  );
}
export function StartTimer({
  source,
  label = "Démarrer le timer",
}: {
  source: TimeSource;
  label?: string;
}) {
  const t = useTime();
  return (
    <Button
      variant="secondary"
      disabled={t.busy || !t.data}
      onClick={() => t.start(source)}
    >
      {label}
    </Button>
  );
}
export function TimerStrip({ mobile = false }: { mobile?: boolean }) {
  const t = useTime(),
    s = t.data?.unfinished.find((s) => s.status === "running");
  return (
    <div
      className={mobile ? "mobile-timer time-strip" : "timer-slot time-strip"}
    >
      {s ? (
        <>
          <Link to="/focus" title={s.title}>
            {s.title} · {durationLabel(actualSeconds(s, s.pauses, t.now))}
          </Link>
          <button
            disabled={t.busy}
            onClick={() => void t.command({ kind: "pause", id: s.id })}
            aria-label="Pause timer"
          >
            Ⅱ
          </button>
        </>
      ) : (
        <button disabled={!t.data} onClick={() => t.start({ kind: "quick" })}>
          Démarrer un Timer
        </button>
      )}
      {!s && !!t.data?.unfinished.length && (
        <Link to="/focus">{t.data.unfinished.length} en pause</Link>
      )}
      {!s && <Link to="/focus">Focus</Link>}
    </div>
  );
}
export function TodayTime() {
  const t = useTime();
  return (
    <section className="today-planning">
      <h2>Votre temps</h2>
      {t.data ? (
        <>
          <p>{durationLabel(t.data.today_seconds)} suivies aujourd’hui</p>
          {t.data.unfinished
            .filter((s) => s.status === "running")
            .map((s) => (
              <p key={s.id}>
                {s.title} · {durationLabel(actualSeconds(s, s.pauses, t.now))}
                {s.planned_minutes != null &&
                  ` / ${s.planned_minutes} min prévues`}
              </p>
            ))}
          <Link to="/focus">Ouvrir Focus et les sessions</Link>
        </>
      ) : (
        <p>{t.error || "Chargement du temps suivi…"}</p>
      )}
    </section>
  );
}
