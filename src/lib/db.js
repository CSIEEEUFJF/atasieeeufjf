import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis;

function getRuntimeDatabaseUrl() {
  return (
    process.env.APP_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL
  );
}

function getPoolMax() {
  const configuredValue = Number(process.env.DATABASE_POOL_MAX || process.env.POSTGRES_POOL_MAX || 1);
  return Number.isFinite(configuredValue) && configuredValue > 0
    ? Math.floor(configuredValue)
    : 1;
}

function createPrismaClient() {
  const connectionString = getRuntimeDatabaseUrl();

  if (!connectionString) {
    throw new Error("Banco não configurado. Informe APP_DATABASE_URL, POSTGRES_URL, PRISMA_DATABASE_URL ou DATABASE_URL.");
  }

  const pool = new Pool({
    allowExitOnIdle: true,
    connectionString,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 5000),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 10000),
    max: getPoolMax(),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export function nowDate() {
  return new Date();
}

export function nowIso() {
  return nowDate().toISOString();
}
