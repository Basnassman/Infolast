import { EventEmitter } from "events";

export interface TaskEventPayload {
  userTaskId?: string;
  userId?: string;
  taskId?: string;
  status?: string;
  points?: number;
  isActive?: boolean;
}

class TaskEventEmitter extends EventEmitter {
  emitTaskSubmitted(payload: TaskEventPayload) {
    this.emit("task.submitted", payload);
  }

  emitTaskApproved(payload: TaskEventPayload) {
    this.emit("task.approved", payload);
  }

  emitTaskRejected(payload: TaskEventPayload) {
    this.emit("task.rejected", payload);
  }

  emitTaskCreated(payload: TaskEventPayload) {
    this.emit("task.created", payload);
  }

  emitTaskUpdated(payload: TaskEventPayload) {
    this.emit("task.updated", payload);
  }
}

export const taskEventEmitter = new TaskEventEmitter();

// ─── Event Handlers ─────────────────────────────────────────────────────────

taskEventEmitter.on("task.submitted", (payload) => {
  console.log("[EVENT] task.submitted:", payload);
  // Queue for processing, notifications, etc.
});

taskEventEmitter.on("task.approved", (payload) => {
  console.log("[EVENT] task.approved:", payload);
  // Trigger Merkle rebuild if needed
  // Update leaderboard, etc.
});

taskEventEmitter.on("task.rejected", (payload) => {
  console.log("[EVENT] task.rejected:", payload);
  // Log for analytics, notify user, etc.
});