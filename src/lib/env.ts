import { z } from 'zod'

const envSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1, '需要设置 CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: z.string().min(1, '需要设置 CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: z.string().min(1, '需要设置 CLOUDINARY_API_SECRET'),
  ADMIN_PASSWORD: z.string().min(6, '管理员密码至少需要6个字符'),
  DATABASE_URL: z.string().min(1, '需要设置 DATABASE_URL'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

let env: Env

try {
  env = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ 环境变量配置错误:')
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`)
    })
    console.error('\n请配置以下环境变量:')
    console.error('  - CLOUDINARY_CLOUD_NAME')
    console.error('  - CLOUDINARY_API_KEY')
    console.error('  - CLOUDINARY_API_SECRET')
    console.error('  - ADMIN_PASSWORD')
    console.error('  - DATABASE_URL')
    process.exit(1)
  }
  throw error
}

export { env }