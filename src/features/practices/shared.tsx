import { useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { savePractice, getPractices } from "./api";
import type { PracticeCommand } from "../../types/practices";
export type PracticeData = Awaited<ReturnType<typeof getPractices>>;
export function usePracticeMutation() {
  const router = useRouter(),
    lock = useRef(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(data: PracticeCommand) {
    if (lock.current) return null;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await savePractice({ data });
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      await router.invalidate();
      return result.id;
    } catch {
      setError("Enregistrement impossible. Réessayez.");
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error };
}
export function PracticeNav() {
  return (
    <nav className="practice-nav" aria-label="Pratiques de Life">
      <Link to="/life" activeOptions={{ exact: true }}>
        Life Areas
      </Link>
      <Link to="/life/habits" search={{ archived: false }}>
        Habits
      </Link>
      <Link to="/routines" search={{ archived: false }}>
        Routines
      </Link>
      <Link to="/life/trackers" search={{ archived: false }}>
        Trackers
      </Link>
    </nav>
  );
}
export const dayStates = {
  done: "Done",
  skip: "Skip",
  missed: "Missed",
  progress: "En cours",
  pending: "À renseigner",
  paused: "En pause",
  off: "Non prévu",
};
export const round = (v: number) => Math.round(v * 100) / 100;
