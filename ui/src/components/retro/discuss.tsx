import { createSocketEvent, SocketEvent } from "@/events";
import { useColumnActions } from "@/hooks/use-columns";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { useSocketEvent } from "@/hooks/use-retro-socket";
import { api } from "@/lib/api";
import { Task as TaskType } from "@/types";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { EmptyColumn, NoteSkeletons } from "./column-states";
import { Column, Columns } from "./columns";
import { Note } from "./note";
import { NoteGroup } from "./note-group";
import { Task } from "./task";
import TaskDialog, { TaskData } from "./task-dialog";
import { DialogTrigger } from "../ui/dialog";

interface Vote {
  group_id: string;
  count: number;
}

export default function Discuss() {
  const { retro } = useRetro();
  const { notes, groupedNotes, loaded, dispatch } = useNotes();
  const columnActions = useColumnActions(notes);

  const [votes, setVotes] = useState<Vote[]>([]);
  const [tasks, setTasks] = useState<TaskType[]>([]);

  useEffect(() => {
    api.get(`/api/retros/${retro.id}/votes`).then((res) => {
      setVotes(res.data);
    });

    api.get(`/api/retros/${retro.id}/tasks`).then((res) => {
      setTasks(res.data);
    });
  }, [retro.id]);

  const groupedNotesForColumn = useCallback(
    (columnId: string) => {
      const cols = [...Object.entries(groupedNotes[columnId] ?? [])];

      cols.sort(([aGroupId], [bGroupId]) => {
        const countFor = (groupId: string) =>
          votes.find((v) => v.group_id === groupId)?.count ?? 0;

        return countFor(bGroupId) - countFor(aGroupId);
      });

      return cols;
    },
    [groupedNotes, votes],
  );

  useSocketEvent((event: SocketEvent) => {
    switch (event.name) {
      case "task_created":
        setTasks((tasks) => [...tasks, event.payload as TaskType]);
        break;
      case "task_updated": {
        const payload = event.payload as TaskType;

        setTasks((tasks) =>
          tasks.map((t) => (t.id === payload.id ? payload : t)),
        );
        break;
      }
    }
  });

  function handleNewTask(data: {
    who: string;
    what: string;
    when: Date | string;
  }) {
    dispatch(createSocketEvent("task_create", data));
  }

  function handleEditTask(id: string, data: TaskData) {
    dispatch(
      createSocketEvent("task_update", {
        id,
        ...data,
      }),
    );
  }

  function handleTaskComplete(id: string, completed: boolean) {
    dispatch(
      createSocketEvent("task_complete", {
        id,
        completed,
      }),
    );
  }

  return (
    <Columns
      // The synthetic Tasks column below is a child but not a real column.
      count={retro.columns.length + 1}
      onAddColumn={columnActions.create}
      canAddColumn={columnActions.canCreate}
    >
      {retro.columns.map((column, index) => {
        const groups = groupedNotesForColumn(column.id);

        return (
          <Column
            column={column}
            index={index}
            key={column.id}
            {...columnActions.forColumn(column)}
          >
            {!loaded && <NoteSkeletons />}

            {loaded && groups.length === 0 && (
              <EmptyColumn>Nothing came up here.</EmptyColumn>
            )}

            <AnimatePresence mode="popLayout" initial={false}>
              {groups.map(([groupId, groupNotes]) => (
                <NoteGroup
                  key={groupId}
                  voteCount={{
                    forGroup:
                      votes.find((v) => v.group_id === groupId)?.count ?? 0,
                    total: votes.reduce((acc, v) => acc + v.count, 0),
                  }}
                  authors={Array.from(
                    new Set(
                      groupNotes
                        .map((note) => note.created_by_name)
                        .filter((name): name is string => Boolean(name)),
                    ),
                  )}
                >
                  {groupNotes.map((note) => (
                    <Note key={note.id} note={note} />
                  ))}
                </NoteGroup>
              ))}
            </AnimatePresence>
          </Column>
        );
      })}

      <Column
        index={retro.columns.length}
        column={{
          id: "tasks",
          title: "Tasks",
          description: "What are we actually going to do?",
        }}
      >
        <TaskDialog
          title="New task"
          description="Capture an action item from the discussion."
          onSave={handleNewTask}
        >
          <DialogTrigger asChild>
            <Button variant="default" className="w-full">
              <Plus />
              Add a task
            </Button>
          </DialogTrigger>
        </TaskDialog>

        {tasks.length === 0 && (
          <EmptyColumn>No action items yet.</EmptyColumn>
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          {[...tasks]
            .sort((a, b) => Number(a.completed) - Number(b.completed))
            .map((task) => (
              <Task
                key={task.id}
                task={task}
                onEdit={(d) => handleEditTask(task.id, d)}
                onComplete={(c) => handleTaskComplete(task.id, c)}
              />
            ))}
        </AnimatePresence>
      </Column>
    </Columns>
  );
}
