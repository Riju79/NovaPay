const { PrismaClient } = require('@prisma/client');
const bcryptjs = require('bcryptjs');
const prisma = new PrismaClient();

const action = process.argv[2];
const param1 = process.argv[3];
const param2 = process.argv[4];

async function main() {
  if (action === 'reset-password') {
    const email = param1;
    const newPassword = param2 || 'password123';
    
    if (!email) {
      console.error("Error: Please provide an email address.");
      process.exit(1);
    }
    
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      console.error(`Error: User with email '${normalizedEmail}' not found.`);
      process.exit(1);
    }

    const salt = await bcryptjs.genSalt(10);
    const password_hash = await bcryptjs.hash(newPassword, salt);

    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password_hash }
    });

    console.log(`Success: Password for '${normalizedEmail}' has been reset to '${newPassword}'`);
  } else if (action === 'delete-user') {
    const email = param1;
    if (!email) {
      console.error("Error: Please provide an email address.");
      process.exit(1);
    }
    
    const normalizedEmail = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      console.error(`Error: User with email '${normalizedEmail}' not found.`);
      process.exit(1);
    }

    // Delete related notifications and transactions if any exist to avoid foreign key errors
    await prisma.notification.deleteMany({ where: { wallet_address: user.wallet_address } });
    await prisma.transaction.deleteMany({
      where: {
        OR: [
          { sender_wallet: user.wallet_address },
          { recipient_wallet: user.wallet_address }
        ]
      }
    });

    await prisma.user.delete({ where: { email: normalizedEmail } });
    console.log(`Success: User '${normalizedEmail}' has been deleted.`);
  } else if (action === 'clear-users') {
    await prisma.notification.deleteMany({});
    await prisma.transaction.deleteMany({});
    const deleted = await prisma.user.deleteMany({});
    console.log(`Success: Cleared all users (${deleted.count} users deleted) from database.`);
  } else {
    console.log(`
NovaPay Database Management CLI
-------------------------------
Usage:
  node manage_db.js reset-password <email> [newPassword]
  node manage_db.js delete-user <email>
  node manage_db.js clear-users
    `);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
