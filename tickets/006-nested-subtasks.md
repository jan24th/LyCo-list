---
Title: Nested Subtasks
Status: TODO
Labels: frontend, features
Estimate: M
PHASE: 1
CYCLE: 1
---

# Nested Subtasks

## User Story

As a user, I want to create unlimited levels of subtasks under any task, so that I can break down work into smaller pieces while keeping the same task features for every level.

## Acceptance Criteria

### Scenario 1: Create a subtask

Given a task exists
When the user adds a subtask under it
Then the subtask appears nested under the parent task

### Scenario 2: Subtask has full task features

Given a subtask exists
When the user views its detail
Then the subtask supports title, notes, priority, flag, due date, and reminders just like a parent task

### Scenario 3: Delete parent task with subtasks

Given a parent task has subtasks
When the user tries to delete the parent
Then the app prevents deletion and shows a warning to remove or move subtasks first

### Scenario 4: Move parent task to another list

Given a parent task has subtasks
When the user moves the parent to another list
Then all descendant subtasks are moved to the same list automatically

### Scenario 5: Cascade-complete prompt

Given a parent task has subtasks
When the user marks the parent complete
Then the app prompts whether to also complete all subtasks

### Scenario 6: Complete subtasks independently

Given a subtask is incomplete
When the user toggles it complete
Then the subtask is marked complete without affecting the parent task state

### Scenario 7: Display nested structure in task detail

Given a task has multiple levels of subtasks
When the user opens the task detail
Then the hierarchy is rendered clearly and each level is expandable
