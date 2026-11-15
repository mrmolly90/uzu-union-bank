import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./prisma/uzu_bank.db' } },
});

async function main() {
  const email = process.argv[2] || 'willkev913@gmail.com';
  const newPassword = process.argv[3] || 'TestPass123';
  const newPin = process.argv[4] || '1234';
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const bankPinHash = await bcrypt.hash(newPin, 12);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, bankPinHash },
    });
    
    console.log('Password reset for:', email);
    console.log('New password:', newPassword);
    console.log('New PIN:', newPin);
  } else {
    console.log('User not found:', email);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);