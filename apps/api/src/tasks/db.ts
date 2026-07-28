// Barrel — re-exports for backward compatibility.
// Prefer importing from individual sub-modules (repo / write / lifecycle) for new code.
export {
  buildGsi,
  buildKeys,
  getTaskById,
  getTaskTree,
  queryChildrenByList,
  queryTasksByList,
  toRecord,
  toTask,
  type TaskNode,
} from "./repo.js";

export {
  createTask,
  deleteTask,
  updateTask,
} from "./write.js";

export {
  completeTask,
  moveTask,
  restoreTask,
} from "./lifecycle.js";
