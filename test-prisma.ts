import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
    const config = await prisma.hotelConfig.upsert({
        where: { key: 'test_toggle' },
        update: { value: false, description: "Test" },
        create: { key: 'test_toggle', value: false, description: "Test" },
    });
    console.log(config);
}
main().catch(console.error).finally(() => prisma.$disconnect())
