import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input, Label, SearchField, TextArea, TextField } from "react-aria-components";
import { Sheet } from "@/components/dialog";
import { button, input } from "@/components/ui";
import { api } from "@/lib/api";
import type { Note } from "@/lib/retro";
import { useBoard } from "./context";

type Props = { note: Note | null; columnId?: string; onClose: () => void };

export function NoteEditor({ note, columnId, onClose }: Props) {
  const { board } = useBoard();
  const column = board.retro.columns.find((c) => c.id === columnId);
  const title = note ? "Edit your thought" : `Add to ${column?.title ?? "the board"}`;
  return (
    <Sheet isOpen onOpenChange={(o) => !o && onClose()} title={title}>
      <EditorForm note={note} columnId={columnId} onClose={onClose} />
    </Sheet>
  );
}

function EditorForm({ note, columnId, onClose }: Props) {
  const { board, send, gifSearch } = useBoard();
  const [content, setContent] = useState(note?.content ?? "");
  const [imgUrl, setImgUrl] = useState(note?.imgUrl ?? "");
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const reflecting = board.retro.stage === "reflect";

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setProblem(null);
    try {
      if (note) {
        await send("note.edit", { id: note.id, content, imgUrl });
      } else {
        await send("note.add", { columnId, content });
      }
      onClose();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField value={content} onChange={setContent} isRequired autoFocus className="flex flex-col gap-2">
        <Label className="sr-only">Note</Label>
        <TextArea
          rows={4}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className={`${input} min-h-32 py-2 leading-snug`}
        />
      </TextField>
      <p className="text-sm text-ink-soft">
        {reflecting ? "Nobody else can read this until everyone moves on to grouping. " : ""}Enter saves, Shift+Enter starts a new line.
      </p>

      {note && (
        <div className="flex flex-col gap-3">
          {imgUrl && (
            <div className="flex items-start gap-3">
              <img src={imgUrl} alt="" className="max-h-40 max-w-[60%] object-cover" referrerPolicy="no-referrer" />
              <Button onPress={() => setImgUrl("")} className={button.quiet}>
                Remove image
              </Button>
            </div>
          )}
          {picking ? (
            <ImagePicker gifSearch={gifSearch} onPick={(url) => (setImgUrl(url), setPicking(false))} onCancel={() => setPicking(false)} />
          ) : (
            <Button onPress={() => setPicking(true)} className={`${button.line} self-start`}>
              {imgUrl ? "Change the image" : "Add an image"}
            </Button>
          )}
        </div>
      )}

      {problem && (
        <p role="alert" className="bg-alert px-3 py-2 font-semibold">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className={button.solid}>
          Save
        </Button>
        <Button onPress={onClose} className={button.quiet}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type GifPage = { results: { preview_url: string; url: string; width?: number; height?: number }[]; has_next: boolean };

function ImagePicker({ gifSearch, onPick, onCancel }: { gifSearch: boolean; onPick: (url: string) => void; onCancel: () => void }) {
  const [link, setLink] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  const gifs = useQuery({
    queryKey: ["gifs", debounced],
    queryFn: () => api<GifPage>(`/api/gifs?q=${encodeURIComponent(debounced)}`),
    enabled: gifSearch,
    staleTime: 60_000,
  });
  const linkOK = /^https:\/\/\S+$/.test(link.trim());

  return (
    <div className="flex flex-col gap-4 border-[2.5px] border-ink p-3">
      {gifSearch && (
        <>
          <SearchField value={q} onChange={setQ} aria-label="Search GIFs" className="flex">
            <Input placeholder="Search GIFs" className={input} />
          </SearchField>
          {gifs.isError && <p className="bg-alert px-3 py-2">{(gifs.error as Error).message}</p>}
          <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto" aria-label="GIFs">
            {gifs.data?.results.map((g) => (
              <li key={g.url}>
                <Button onPress={() => onPick(g.url)} className="block w-full" aria-label="Use this GIF">
                  <img src={g.preview_url} alt="" className="aspect-square w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <TextField value={link} onChange={setLink} className="flex flex-col gap-1">
        <Label className="font-bold">{gifSearch ? "Or paste a link" : "Paste a link to an image"}</Label>
        <Input className={input} placeholder="https://" />
      </TextField>
      {linkOK && <img src={link.trim()} alt="Preview" className="max-h-40 self-start object-contain" referrerPolicy="no-referrer" />}
      <div className="flex gap-3">
        <Button isDisabled={!linkOK} onPress={() => onPick(link.trim())} className={button.line}>
          Use this link
        </Button>
        <Button onPress={onCancel} className={button.quiet}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
