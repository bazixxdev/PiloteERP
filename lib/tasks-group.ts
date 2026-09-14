import { dayjs } from "./format";
import type { TaskView } from "@/components/tasks/task-list";

// Regroupement par échéance (vue « À faire ») : ce qui presse d'abord, sans date à la fin. Côté client comme côté serveur.
export type DueGroup = { key: "late" | "today" | "week" | "later" | "none"; label: string; tasks: TaskView[] };
export function groupByDue(tasks: TaskView[]): DueGroup[] {
  const today = dayjs().startOf("day");
  const weekEnd = today.endOf("isoWeek");
  const groups: DueGroup[] = [
    { key: "late", label: "En retard", tasks: [] }, { key: "today", label: "Aujourd'hui", tasks: [] }, { key: "week", label: "Cette semaine", tasks: [] },
    { key: "later", label: "Plus tard", tasks: [] }, { key: "none", label: "Sans date", tasks: [] },
  ];
  for (const t of tasks) {
    if (!t.dueDate) { groups[4].tasks.push(t); continue; }
    const d = dayjs(t.dueDate).startOf("day");
    (d.isBefore(today) ? groups[0] : d.isSame(today) ? groups[1] : !d.isAfter(weekEnd, "day") ? groups[2] : groups[3]).tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}
