---
Title: Database Import and Export
Status: TODO
Labels: frontend, data-layer
Estimate: M
PHASE: 1
CYCLE: 1
---

# Database Import and Export

## User Story

As a user, I want to back up and restore my todo data, so that I can migrate my data between devices or browsers without losing anything.

## Acceptance Criteria

### Scenario 1: Export all data to JSON

Given the user has lists and tasks
When they trigger the export action
Then a `.lyco.json` file is downloaded containing all lists and tasks plus a schema version

### Scenario 2: Import data from JSON

Given the user selects a valid `.lyco.json` file
When the import action completes
Then the current IndexedDB contents are replaced with the imported data

### Scenario 3: Validate schema version

Given the imported file has a different schema version
When the import is initiated
Then the app detects the mismatch and runs an automatic migration to the latest schema

### Scenario 4: Reject corrupted imports

Given the imported file is invalid JSON or missing required fields
When the import is attempted
Then the app shows an error and does not modify the existing database

### Scenario 5: Restore data after fresh install

Given a new browser instance opens the app
When the user imports a previously exported `.lyco.json` file
Then all lists, tasks, reminders, and subtasks are restored exactly
