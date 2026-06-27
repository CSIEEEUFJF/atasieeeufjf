import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanRole(value) {
  return String(value || "").trim();
}

async function main() {
  const rasMembers = await prisma.user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
    where: {
      chapters: {
        some: { chapterKey: "RAS" },
      },
    },
  });

  if (!rasMembers.length) {
    console.log("Nenhum membro da RAS encontrado.");
    return;
  }

  await prisma.userChapter.createMany({
    data: rasMembers.map((user) => ({
      chapterKey: "CAS",
      userId: user.id,
    })),
    skipDuplicates: true,
  });

  let updatedRoles = 0;

  for (const user of rasMembers) {
    const currentRoles = isPlainObject(user.chapterRoles) ? user.chapterRoles : {};
    const nextRoles = { ...currentRoles };
    const legacyCargo = cleanRole(user.cargo);

    if (!nextRoles.RAS && legacyCargo) {
      nextRoles.RAS = legacyCargo;
    }

    if (!nextRoles.CAS) {
      nextRoles.CAS = "Membro";
    }

    if (JSON.stringify(nextRoles) !== JSON.stringify(currentRoles)) {
      await prisma.user.update({
        data: { chapterRoles: nextRoles },
        where: { id: user.id },
      });
      updatedRoles += 1;
    }
  }

  console.log(`Membros da RAS processados: ${rasMembers.length}`);
  console.log(`Vinculos CAS criados ou preservados: ${rasMembers.length}`);
  console.log(`Usuarios com chapterRoles atualizados: ${updatedRoles}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
