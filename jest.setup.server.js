// Mock environment variables for testing
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-key'
process.env.CLOUDINARY_API_SECRET = 'test-secret'
process.env.ADMIN_PASSWORD = 'test-password'
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://test:test@localhost:3306/test'



// 统一关闭全局 Prisma 连接，避免 Jest server 项目残留打开的数据库句柄
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { prisma } = require('./src/lib/prisma');
    if (typeof afterAll === 'function') {
        afterAll(async () => {
            try {
                await prisma.$disconnect();
            } catch (e) {
                // 测试环境断开失败不应影响测试结果
                console.error('Failed to disconnect Prisma in Jest teardown:', e);
            }
        });
    }
} catch (e) {
    // 在某些不加载 Prisma 的测试环境中静默忽略
}
