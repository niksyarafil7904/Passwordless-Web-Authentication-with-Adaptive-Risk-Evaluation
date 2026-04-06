import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdmin() {
  const username = 'admin';
  const email = 'admin@testonline.digital';

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ 
    where: { username } 
  });
  
  if (existing) {
    console.log('Admin user already exists!');
    console.log('   Username:', existing.username);
    console.log('   Email:', existing.email);
    return;
  }

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      username,
      email,
      isAdmin: true,
    },
  });

  console.log('Admin user created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Username:', admin.username);
  console.log('Email:', admin.email);
  console.log('Role: Admin');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(' IMPORTANT NEXT STEPS:');
  console.log('   1. Go to the login page');
  console.log('   2. Login as "admin"');
  console.log('   3. Complete Windows Hello registration');
  console.log('   4. You will be redirected to Admin Dashboard');
  console.log('');
}

createAdmin()
  .catch((error) => {
    console.error(' Error creating admin:', error);
  })
  .finally(() => prisma.$disconnect());