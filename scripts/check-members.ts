import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    include: { members: { include: { user: true } } }
  });
  console.log("PROJECT DETAILS:");
  for (const p of projects) {
    console.log(`- Project "${p.name}" (ID: ${p.id}):`);
    console.log(`  OwnerId: ${p.ownerId}`);
    console.log(`  Members (${p.members.length}):`);
    for (const m of p.members) {
      console.log(`    * User "${m.user.name}" (ID: ${m.userId}, Email: ${m.user.email}) - Role: ${m.role}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
