# LyCo-list Todo App Design

## Goal

Build a Web App / PWA todo application that matches the core experience of Apple Reminders, starting with a local-first architecture and a clear path to cloud sync in later phases.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Routing | TanStack Router |
| Data Layer | TanStack Query + Dexie.js (IndexedDB) |
| Client State | TanStack Store |
| Forms | TanStack Form |
| PWA | vite-plugin-pwa |
| Notifications | Service Worker + Notification API |
| Icons | Lucide React |
| Utilities | date-fns, uuid |

## Scope

### In MVP (Phase 1)

- **Tasks**: create, edit, delete, complete, priority, flag, due date, reminders.
- **Unlimited nested subtasks**: child tasks have the same feature set as parent tasks; completing a parent task prompts to cascade-complete children.
- **Custom lists**: name, color, icon, order.
- **Smart lists**: Today, Scheduled, All, Flagged, Completed.
- **Search**: full-text search across task titles and notes.
- **Recurring reminders**: none, daily, weekly, biweekly, monthly, yearly, weekdays.
- **Full-database import/export**: JSON backup and restore with version compatibility check.
- **PWA offline support**: installable, Service Worker cached static assets, data persisted in IndexedDB.
- **Browser notifications**: trigger reminders when PWA is installed and permission granted.

### Out of MVP

- Cloud sync and user accounts.
- Shared lists.
- Location-based reminders.
- Attachments/images.
- Natural language input.
- Siri / Shortcuts integration.

## Architecture

### Client-Side Data Flow

1. UI components read from TanStack Query caches.
2. TanStack Query `queryFn` wraps Dexie.js calls to IndexedDB.
3. Mutations write to IndexedDB and invalidate relevant Query caches.
4. TanStack Store holds ephemeral UI state: search query, active modals, selected task.
5. Service Worker listens for scheduled reminders and fires Notification API events.

### PWA Strategy

- Use `vite-plugin-pwa` to generate `manifest.json` and Service Worker.
- Static assets are cached for offline use.
- Application data lives in IndexedDB, not localStorage, to support larger volume and structured queries.
- Reminder scheduling is done in the Service Worker because Web page timers are unreliable when the page is closed.

## Data Model

```typescript
interface List {
  id: string;
  name: string;
  color: string;        // Tailwind color token, e.g. "red-500"
  icon: string;         // Lucide icon name, e.g. "house"
  order: number;
  createdAt: number;
  updatedAt: number;
}

interface Reminder {
  id: string;
  taskId: string;
  triggerAt: number;    // Unix timestamp (ms)
  recurrence:
    | 'none'
    | 'daily'
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'yearly'
    | 'weekdays';
  nextTriggerAt?: number;
  isEnabled: boolean;
}

interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  parentId: string | null;   // null = root task
  isCompleted: boolean;
  isFlagged: boolean;
  priority: 'none' | 'low' | 'medium' | 'high';
  dueDate?: number;        // Unix timestamp (ms) at midnight local
  dueTime?: string;        // HH:MM
  order: number;           // Order among siblings
  reminders: Reminder[];
  createdAt: number;
  updatedAt: number;
}
```

### Design Rules

- Subtasks are first-class tasks; they can have their own reminders, due dates, priorities, and flags.
- Smart lists aggregate tasks by their own attributes, including subtasks.
- When a parent task is marked complete, the app prompts: "Also complete all subtasks?" with options "Yes", "No".
- Reminders are stored inside the task record for simplicity; the next occurrence is computed when the current one fires or when the recurrence rule changes.
- Lists have a display order used for manual sorting.
- Tasks have a sibling order; nested order is handled separately per parent.

## Smart Lists Definition

| List | Filter |
|---|---|
| Today | `dueDate` is today and `isCompleted === false` |
| Scheduled | `dueDate` exists and `isCompleted === false` |
| All | `isCompleted === false` |
| Flagged | `isFlagged === true` and `isCompleted === false` |
| Completed | `isCompleted === true` |

The default list view is the first custom list or Today if none exist.

## Notification & Reminder Behavior

- On creating/editing a reminder, the app registers the next trigger time with the Service Worker.
- The Service Worker wakes up and checks due reminders using `self.registration.showNotification`.
- For recurrence, after firing, the next trigger time is computed and stored; if no recurrence, the reminder is disabled.
- Recurring rules use `date-fns` add helpers:
  - `daily` -> `addDays(..., 1)`
  - `weekly` -> `addWeeks(..., 1)`
  - `biweekly` -> `addWeeks(..., 2)`
  - `monthly` -> `addMonths(..., 1)`
  - `yearly` -> `addYears(..., 1)`
  - `weekdays` -> next Monday-Friday date

## Database Import / Export

- Export: serialize all `List` and `Task` records into a JSON object with a schema version field.
- Import: validate schema version, warn if mismatched, then replace the current IndexedDB contents in a transaction.
- File extension: `.lyco.json`.
- Future compatibility: bump schema version on breaking changes; older exports may be migrated with a transform function.

## UI Structure

- **Sidebar / Navigation**: smart lists + custom lists + "New List" button.
- **Main Pane**: list title, task list, add-task input at top.
- **Task Detail Sheet/Modal**: title, notes, due date/time, reminders, priority, flag, list, subtasks.
- **Search Bar**: filters current list or global based on context.
- **Install Prompt**: banner/button for PWA install when criteria are met.

## Roadmap

### Phase 1: MVP (5–7 weeks)

1. Project scaffolding with Vite, React, TypeScript, Tailwind, TanStack Router/Query/Store/Form.
2. PWA setup with manifest and Service Worker.
3. IndexedDB schema and Dexie.js data access layer.
4. Full-database import/export (JSON backup/restore).
5. Task CRUD, completion, priority, flag.
6. Unlimited nested subtasks with cascade-complete prompt.
7. Custom lists with color/icon.
8. Smart lists: Today, Scheduled, All, Flagged, Completed.
9. Search.
10. Due dates and recurring reminders.
11. Browser notifications via Service Worker.

### Phase 2: Polish (2–3 weeks)

- Drag-and-drop reordering within/across lists and nesting levels.
- Bulk actions: complete, move, delete, flag.
- Keyboard shortcuts.
- Empty states and onboarding.
- Animations and transitions.
- Import additional formats (ICS, CSV).

### Phase 3: Cloud Sync (4–6 weeks)

- User accounts (Supabase or Clerk).
- Multi-device sync.
- Conflict resolution strategy: last-write-wins with optional manual merge.
- Optional real-time sync via WebSocket/Supabase Realtime.
- Shared lists (read-only and collaborative).

### Phase 4: Advanced Features (as needed)

- Natural language input for date/time parsing.
- Location-based reminders.
- Attachments and images.
- Siri Shortcuts / share target integration.
- PWA widgets and quick actions.

## Success Criteria

- App works offline in the browser and as an installed PWA.
- Data survives page refresh and browser restart.
- Reminder notifications fire on time when PWA is installed and permission granted.
- Smart lists update correctly as tasks are created, edited, or completed.
- Database export can be imported into a fresh browser instance and restore all data.

## Open Decisions (to resolve before planning)

None. All major decisions in this version have been validated with the user.
