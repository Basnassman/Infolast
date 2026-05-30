export const normalizeTask = (task: any) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  points: task.points,
  platform: task.platform,
  type: task.type,
  url: task.url,
  isActive: task.isActive,
  maxSubmissions: task.maxSubmissions,
  createdAt: task.createdAt?.toISOString?.() || task.createdAt,
  updatedAt: task.updatedAt?.toISOString?.() || task.updatedAt,
});

export const normalizeUserTask = (ut: any) => ({
  id: ut.id,
  userId: ut.userId,
  taskId: ut.taskId,
  status: ut.status,
  rewardGiven: ut.rewardGiven,
  points: ut.points,
  completedAt: ut.completedAt?.toISOString?.() || ut.completedAt,
  reviewedAt: ut.reviewedAt?.toISOString?.() || ut.reviewedAt,
  createdAt: ut.createdAt?.toISOString?.() || ut.createdAt,
  updatedAt: ut.updatedAt?.toISOString?.() || ut.updatedAt,
  task: ut.task ? normalizeTask(ut.task) : undefined,
});

export const normalizeTaskSubmission = (result: any) => ({
  id: result.id,
  status: result.status,
  message: result.message,
  points: result.points,
  totalPoints: result.totalPoints,
  rewardGiven: result.rewardGiven,
});