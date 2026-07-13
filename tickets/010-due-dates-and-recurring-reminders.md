---
Title: Due Dates and Recurring Reminders
Status: TODO
Labels: frontend, features, scheduling
Estimate: L
PHASE: 1
CYCLE: 1
---

# Due Dates and Recurring Reminders

## User Story

As a user, I want to set due dates and recurring reminders on tasks, so that I can keep track of deadlines and repeating habits.

## Acceptance Criteria

### Scenario 1: Set due date

Given a task exists
When the user selects a due date
Then the task is associated with that date in UTC and displayed in the local timezone

### Scenario 2: Set due time

Given a task has a due date
When the user selects a due time
Then the reminder can be scheduled for that specific date and time

### Scenario 3: Recurring frequencies

Given a task exists
When the user sets a reminder to repeat daily, weekly, biweekly, monthly, yearly, or weekdays
Then the recurrence rule is stored and the next occurrence is computed correctly

### Scenario 4: Advance recurring task on completion

Given a task has a recurring reminder
When the user marks the task complete
Then the task remains active and its due date and reminder advance to the next scheduled occurrence

### Scenario 5: Disable completed non-recurring reminders

Given a task has a one-time reminder
When the reminder fires and the user completes the task
Then the reminder is disabled and will not fire again

### Scenario 6: Show due tasks in Today and Scheduled lists

Given a task has a due date
When the user opens Today or Scheduled
Then the task appears if it matches the list filter

### Scenario 7: Store timezone consistently

Given the user selects a date in their local timezone
When the task is saved
Then the date is converted to UTC and can be reliably compared across timezones
