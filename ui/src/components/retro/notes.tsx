import { NotesContext, useNotesState } from "@/hooks/use-notes";
import { Note } from "@/types";

export default function NotesProvider({
  notes,
  children,
}: {
  notes: Note[];
  children: React.ReactNode;
}) {
  const value = useNotesState(notes);

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}
