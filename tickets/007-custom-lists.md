---
Title: Custom Lists
Status: TODO
Labels: frontend, features
Estimate: S
PHASE: 1
CYCLE: 1
---

# Custom Lists

## User Story

As a user, I want to organize my tasks into custom lists, so that I can separate work, personal, shopping, or other categories.

## Acceptance Criteria

### Scenario 1: Create a custom list

Given the user is on the sidebar
When they create a new list with a name
Then the list appears in the sidebar and can be selected

### Scenario 2: Assign a color to a list

Given a custom list exists
When the user selects a color
Then the list indicator and related UI elements use that color

### Scenario 3: Assign an icon to a list

Given a custom list exists
When the user selects an icon
Then the icon appears next to the list name in the sidebar

### Scenario 4: Reorder custom lists

Given multiple custom lists exist
When the user drags a list in the sidebar
Then the list order is updated and persisted

### Scenario 5: Delete a custom list

Given a custom list is empty or all tasks have been moved
When the user deletes it
Then the list is removed and its tasks are no longer accessible from that list

### Scenario 6: Move task to another list

Given a task exists in a list
When the user moves it to another custom list
Then the task appears in the target list and disappears from the source list
