---
Title: Smart Lists
Status: TODO
Labels: frontend, features
Estimate: M
PHASE: 1
CYCLE: 1
---

# Smart Lists

## User Story

As a user, I want pre-built views that automatically group my tasks, so that I can quickly see what is due today, scheduled, flagged, or already completed.

## Acceptance Criteria

### Scenario 1: Today list

Given tasks have due dates in the local timezone
When the user opens the Today smart list
Then only incomplete tasks due today are shown, sorted by earliest due time then priority

### Scenario 2: Scheduled list

Given tasks have due dates
When the user opens the Scheduled smart list
Then all incomplete tasks with a due date are shown, sorted by due date ascending

### Scenario 3: All list

Given there are incomplete tasks
When the user opens the All smart list
Then all incomplete tasks are shown, sorted by creation date descending

### Scenario 4: Flagged list

Given some tasks are flagged
When the user opens the Flagged smart list
Then all incomplete flagged tasks are shown, sorted by priority then due date

### Scenario 5: Completed list

Given some tasks are completed
When the user opens the Completed smart list
Then all completed tasks are shown, sorted by completion time descending

### Scenario 6: Include subtasks in smart lists

Given a subtask has its own due date or flag
When the user opens the corresponding smart list
Then the subtask appears independently based on its own attributes

### Scenario 7: Default view

Given the user opens the app
When no custom list is selected
Then the default view is the first custom list, or Today if no custom lists exist
