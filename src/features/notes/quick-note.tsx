import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Input,
  Textarea,
  Button,
} from "../../design-system/components/primitives";
import { useNotesMutation } from "./view";
export function QuickNote() {
  const m = useNotesMutation(),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [id, setId] = useState<string | null>(null);
  return (
    <form
      className="time-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = await m.run({
          kind: "create-note",
          values: { title: title.trim() || "Note rapide", body, kind: "quick" },
        });
        if (next) {
          setId(next);
          setTitle("");
          setBody("");
        }
      }}
    >
      <Input
        label="Titre de la note rapide"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={300}
      />
      <Textarea
        label="Note rapide"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <Button type="submit" disabled={m.busy}>
        Capturer la note
      </Button>
      {id && (
        <p role="status">
          Note enregistrée.{" "}
          <Link to="/notes" search={{ view: "notes", id, archived: false }}>
            Ouvrir la note
          </Link>
        </p>
      )}
      {m.error && <p role="alert">{m.error}</p>}
    </form>
  );
}
