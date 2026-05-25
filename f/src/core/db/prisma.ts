import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_O8DkZwEjclv2@ep-curly-waterfall-ammkb29s-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });