// Reminder editor uses the profile timezone, independently of the browser timezone.
export function localReminder(
  instant: string | null,
  timezone: string,
): string {
  if (!instant) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (key: string) => parts.find((part) => part.type === key)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function reminderFromLocal(
  value: string,
  timezone: string,
): string | null {
  if (!value) return null;
  const wall = Date.parse(`${value}:00Z`);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const shown = Date.parse(
      `${localReminder(new Date(guess).toISOString(), timezone)}:00Z`,
    );
    guess += wall - shown;
  }
  const instant = new Date(guess).toISOString();
  if (localReminder(instant, timezone) !== value)
    throw new Error(
      "Cette heure n’existe pas dans votre fuseau (changement d’heure).",
    );
  return instant;
}
