---
Title: Browser Notifications
Status: TODO
Labels: frontend, pwa, notifications
Estimate: M
PHASE: 1
CYCLE: 1
---

# Browser Notifications

## User Story

As a user, I want to receive reminder notifications when tasks are due, so that I do not miss important deadlines even if the app is not open.

## Acceptance Criteria

### Scenario 1: Request notification permission

Given the user installs the app or enables notifications
When the app requests permission
Then the user can grant or deny browser notification access

### Scenario 2: Register reminder with service worker

Given a task has a reminder with a future trigger time
When the reminder is saved
Then the next trigger time is registered with the service worker

### Scenario 3: Fire a reminder notification

Given the app is installed as a PWA and permission is granted
When a reminder trigger time is reached
Then a browser notification is shown with the task title and due time

### Scenario 4: Handle recurring reminders

Given a recurring reminder fires
When the notification is shown
Then the next occurrence is computed and re-registered with the service worker

### Scenario 5: Catch up overdue reminders on app open

Given the app was closed when a reminder was due
When the user reopens the app
Then the app detects overdue reminders and surfaces them in a missed reminders list or badge

### Scenario 6: Do not guarantee exact timing

Given the browser or OS constrains background timers
When a reminder is scheduled
Then the app documents that notifications are best-effort and may be delayed
