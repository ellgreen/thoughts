import { createSocketEvent, SocketEvent } from "@/events";
import { useNotes } from "@/hooks/use-notes";
import useRetro from "@/hooks/use-retro";
import { api } from "@/lib/api";
import { Task as TaskType } from "@/types";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
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
  const {
    retro,
    socket: { lastJsonMessage },
  } = useRetro();
  const { groupedNotes, dispatch } = useNotes();

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

  useEffect(() => {
    if (!lastJsonMessage) return;

    const event = lastJsonMessage as SocketEvent;

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
  }, [lastJsonMessage]);

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
    <Columns>
      {retro.columns.map((column) => (
        <Column column={column} key={column.id}>
          {groupedNotesForColumn(column.id).map(([groupId, groupNotes]) => (
            <NoteGroup
              key={groupId}
              voteCount={{
                forGroup: votes.find((v) => v.group_id === groupId)?.count ?? 0,
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
        </Column>
      ))}

      <Column
        column={{
          id: "tasks",
          title: "Tasks",
          description: "Add your tasks here.",
        }}
      >
        <TaskDialog
          title="New Task"
          description="Create a new task here."
          onSave={handleNewTask}
        >
          <DialogTrigger asChild>
            <Button variant="default" className="w-full">
              <Plus />
            </Button>
          </DialogTrigger>
        </TaskDialog>

        {tasks
          .sort((a, b) => Number(a.completed) - Number(b.completed))
          .map((task) => (
            <Task
              key={task.id}
              task={task}
              onEdit={(d) => handleEditTask(task.id, d)}
              onComplete={(c) => handleTaskComplete(task.id, c)}
            />
          ))}
      </Column>
    </Columns>
  );
}
