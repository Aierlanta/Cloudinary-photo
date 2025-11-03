/**
 * Zod验证模式定义
 * 定义数据验证规则和运行时类型检查
 */

import { z } from 'zod';

// 基础验证模式
export const IdSchema = z.string().min(1, 'ID不能为空');
export const NameSchema = z.string().min(1, '名称不能为空').max(100, '名称不能超过100个字符');
export const DescriptionSchema = z.string().max(500, '描述不能超过500个字符').optional();
export const TagSchema = z.string().min(1).max(50);
export const TagsSchema = z.array(TagSchema).max(20, '标签数量不能超过20个');

// 图片验证模式
export const ImageSchema = z.object({
  id: IdSchema,
  cloudinaryId: z.string().min(1, 'Cloudinary ID不能为空'),
  publicId: z.string().min(1, 'Public ID不能为空'),
  url: z.string().url('URL格式不正确'),
  secureUrl: z.string().url('安全URL格式不正确'),
  filename: z.string().min(1, '文件名不能为空'),
  format: z.string().min(1, '文件格式不能为空'),
  width: z.number().positive('宽度必须为正数'),
  height: z.number().positive('高度必须为正数'),
  bytes: z.number().positive('文件大小必须为正数'),
  groupId: IdSchema.optional(),
  uploadedAt: z.date(),
  tags: TagsSchema.default([])
});

// 分组验证模式
export const GroupSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema.default(''),
  createdAt: z.date(),
  imageCount: z.number().min(0, '图片数量不能为负数').default(0)
});

// API参数验证模式
export const APIParameterSchema = z.object({
  name: z.string().min(1, '参数名不能为空').max(50, '参数名不能超过50个字符'),
  type: z.enum(['group', 'custom'], {
    errorMap: () => ({ message: '参数类型必须是group或custom' })
  }),
  allowedValues: z.array(z.string().min(1)).min(1, '至少需要一个允许的值'),
  mappedGroups: z.array(IdSchema),
  isEnabled: z.boolean().default(true)
});

// API配置验证模式
export const APIConfigSchema = z.object({
  id: IdSchema,
  isEnabled: z.boolean().default(true),
  defaultScope: z.enum(['all', 'groups'], {
    errorMap: () => ({ message: '默认范围必须是all或groups' })
  }).default('all'),
  defaultGroups: z.array(IdSchema).default([]),
  allowedParameters: z.array(APIParameterSchema).default([]),
  // 新增：响应模式配置
  enableDirectResponse: z.boolean().default(false),
  // 新增：API Key 鉴权
  apiKeyEnabled: z.boolean().default(false),
  apiKey: z.string().optional(),
  updatedAt: z.date()
});

// 分页选项验证模式
export const PaginationOptionsSchema = z.object({
  page: z.number().int().positive('页码必须为正整数').default(1),
  limit: z.number().int().positive('每页数量必须为正整数').max(100, '每页数量不能超过100').default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  groupId: IdSchema.optional()
}).refine(
  (data) => !data.dateFrom || !data.dateTo || data.dateFrom <= data.dateTo,
  {
    message: '开始日期不能晚于结束日期',
    path: ['dateFrom']
  }
);

// 上传选项验证模式
export const UploadOptionsSchema = z.object({
  folder: z.string().optional(),
  tags: TagsSchema.optional(),
  transformation: z.any().optional(),
  groupId: IdSchema.optional()
});

// API请求验证模式

// 图片上传请求
export const ImageUploadRequestSchema = z.object({
  groupId: IdSchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: TagsSchema.optional()
});

// 图片列表请求
export const ImageListRequestSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  groupId: IdSchema.optional(),
  provider: z.string().optional(), // 新增：图床筛选
  search: z.string().optional(), // 搜索关键词，支持文件名和标签搜索
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['uploadedAt', 'filename', 'bytes']).default('uploadedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// 分组创建请求
export const GroupCreateRequestSchema = z.object({
  name: NameSchema,
  description: DescriptionSchema.default('')
});

// 分组更新请求
export const GroupUpdateRequestSchema = z.object({
  name: NameSchema.optional(),
  description: DescriptionSchema.optional()
}).refine(
  (data) => data.name !== undefined || data.description !== undefined,
  {
    message: '至少需要提供一个要更新的字段'
  }
);

// API配置更新请求
export const APIConfigUpdateRequestSchema = z.object({
  isEnabled: z.boolean().optional(),
  defaultScope: z.enum(['all', 'groups']).optional(),
  defaultGroups: z.array(IdSchema).optional(),
  allowedParameters: z.array(APIParameterSchema).optional(),
  enableDirectResponse: z.boolean().optional(),
  apiKeyEnabled: z.boolean().optional(),
  apiKey: z.string().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: '至少需要提供一个要更新的字段'
  }
);

// 管理员登录请求
export const AdminLoginRequestSchema = z.object({
  password: z.string().min(1, '密码不能为空')
});

// 批量删除请求
export const BulkDeleteRequestSchema = z.object({
  imageIds: z.array(IdSchema).min(1, '至少需要选择一张图片').max(50, '一次最多删除50张图片')
});

// 批量更新请求
export const BulkUpdateRequestSchema = z.object({
  imageIds: z.array(IdSchema).min(1, '至少需要选择一张图片').max(50, '一次最多更新50张图片'),
  updates: z.object({
    groupId: IdSchema.optional(),
    tags: TagsSchema.optional()
  }).refine(
    (data) => data.groupId !== undefined || data.tags !== undefined,
    {
      message: '至少需要提供一个要更新的字段'
    }
  )
});

// 随机图片请求参数验证
export const RandomImageRequestSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())])
).optional();

// 文件验证模式
export const FileValidationSchema = z.object({
  name: z.string().min(1, '文件名不能为空'),
  size: z.number().positive('文件大小必须为正数').max(10 * 1024 * 1024, '文件大小不能超过10MB'),
  type: z.string().refine(
    (type) => type.startsWith('image/'),
    {
      message: '只能上传图片文件'
    }
  )
});

// 环境变量验证模式
export const EnvSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'Cloudinary云名称不能为空'),
  CLOUDINARY_API_KEY: z.string().min(1, 'Cloudinary API密钥不能为空'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'Cloudinary API密钥不能为空'),
  ADMIN_PASSWORD: z.string().min(6, '管理员密码至少需要6个字符'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

// 类型推导
export type ImageType = z.infer<typeof ImageSchema>;
export type GroupType = z.infer<typeof GroupSchema>;
export type APIParameterType = z.infer<typeof APIParameterSchema>;
export type APIConfigType = z.infer<typeof APIConfigSchema>;
export type PaginationOptionsType = z.infer<typeof PaginationOptionsSchema>;
export type UploadOptionsType = z.infer<typeof UploadOptionsSchema>;
export type ImageUploadRequestType = z.infer<typeof ImageUploadRequestSchema>;
export type ImageListRequestType = z.infer<typeof ImageListRequestSchema>;
export type GroupCreateRequestType = z.infer<typeof GroupCreateRequestSchema>;
export type GroupUpdateRequestType = z.infer<typeof GroupUpdateRequestSchema>;
export type APIConfigUpdateRequestType = z.infer<typeof APIConfigUpdateRequestSchema>;
export type AdminLoginRequestType = z.infer<typeof AdminLoginRequestSchema>;
export type BulkDeleteRequestType = z.infer<typeof BulkDeleteRequestSchema>;
export type BulkUpdateRequestType = z.infer<typeof BulkUpdateRequestSchema>;
export type RandomImageRequestType = z.infer<typeof RandomImageRequestSchema>;
export type FileValidationType = z.infer<typeof FileValidationSchema>;
export type EnvType = z.infer<typeof EnvSchema>;