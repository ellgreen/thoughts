import { NotesContext, useNotesState } from "@/hooks/use-notes";

export default function NotesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useNotesState();

  return (
    <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
  );
}
