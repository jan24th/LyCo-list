---
Title: IndexedDB Schema and Data Access Layer
Status: TODO
Labels: frontend, data-layer
Estimate: L
PHASE: 1
CYCLE: 1
---

# IndexedDB Schema and Data Access Layer

## User Story

As a user, I want my tasks and lists to be saved locally, so that my data persists across browser sessions and the app works offline.

## Acceptance Criteria

### Scenario 1: Define Dexie.js schema

Given the app starts for the first time
When Dexie.js initializes the IndexedDB database
Then tables for `lists` and `tasks` exist with correct indexes

### Scenario 2: Store lists and tasks

Given the user creates a list or task
When the mutation completes
Then the record is written to IndexedDB and survives a page refresh

### Scenario 3: Query tasks and lists

Given there are tasks and lists in IndexedDB
When the app queries for a list or a task
Then the results are returned in the expected shape

### Scenario 4: Handle nested tasks

Given a task has subtasks via `parentId`
When querying a parent task
Then the related child tasks can be fetched efficiently

### Scenario 5: Integrate with TanStack Query

Given a data access function exists
When wrapped as a TanStack Query `queryFn`
Then components can read from the cache and mutations invalidate stale data
