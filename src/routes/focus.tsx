import { createFileRoute } from "@tanstack/react-router";
import { FocusView } from "../features/time/focus";
export const Route = createFileRoute("/focus")({ component: FocusView });
