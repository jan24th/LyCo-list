---
Title: Task CRUD
Status: TODO
Labels: frontend, features
Estimate: M
PHASE: 1
CYCLE: 1
---

# Task CRUD

## User Story

As a user, I want to create, edit, and delete tasks, so that I can manage my todo items efficiently.

## Acceptance Criteria

### Scenario 1: Create a task

Given the user is on any list view
When they enter a task title and confirm
Then a new task appears in the selected list

### Scenario 2: Edit a task title

Given a task exists
When the user edits its title and saves
Then the updated title is persisted and reflected in the list

### Scenario 3: Add notes to a task

Given a task exists
When the user adds or edits notes
Then the notes are saved and visible in the task detail view

### Scenario 4: Mark task as complete

Given a task is incomplete
When the user toggles its completion status
Then the task is marked complete and moved to the Completed smart list

### Scenario 5: Mark task as incomplete

Given a task is complete
When the user toggles its completion status
Then the task returns to its original list and smart lists update accordingly

### Scenario 6: Delete a task

Given a task exists
When the user deletes it
Then the task is removed immediately with an undo option shown briefly

### Scenario 7: Set task priority and flag

Given a task exists
When the user sets priority to low, medium, or high, or toggles the flag
Then the task displays the corresponding priority and flag indicators
