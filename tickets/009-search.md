---
Title: Search
Status: TODO
Labels: frontend, features
Estimate: S
PHASE: 1
CYCLE: 1
---

# Search

## User Story

As a user, I want to search my tasks by title and notes, so that I can quickly find specific items without browsing through lists.

## Acceptance Criteria

### Scenario 1: Search by title

Given tasks exist in the database
When the user enters a keyword that matches a task title
Then the matching tasks are returned in the search results

### Scenario 2: Search by notes

Given tasks have notes
When the user enters a keyword that appears in a task note
Then the matching tasks are returned in the search results

### Scenario 3: Empty search results

Given no task matches the search keyword
When the user submits the search
Then an empty state is shown indicating no results

### Scenario 4: Clear search

Given the user has entered a search term
When they clear the search input
Then the previous list view is restored

### Scenario 5: Search performance

Given there are thousands of tasks
When the user types a search query
Then results are returned within a reasonable time because the search uses IndexedDB indexes
