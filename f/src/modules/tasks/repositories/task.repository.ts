// f/src/modules/tasks/repositories/task.repository.ts

async create(data: CreateTaskInput): Promise<Task> {
  // ✅ تأكد ما نبعت id — Prisma تولده
  const { id: _, ...cleanData } = data as any;
  
  return prisma.task.create({ 
    data: cleanData as CreateTaskInput,
  });
},
