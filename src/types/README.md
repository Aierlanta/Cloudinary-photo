# 类型系统文档

本目录包含了随机图片API项目的完整类型定义系统，包括数据模型、错误处理、API接口和数据验证。

## 文件结构

```
src/types/
├── index.ts          # 主入口文件，导出所有类型
├── models.ts         # 核心数据模型定义
├── errors.ts         # 错误类型和错误类定义
├── api.ts           # API请求和响应类型
├── schemas.ts       # Zod验证模式定义
├── validators.ts    # 验证工具函数
├── README.md        # 本文档
└── __tests__/       # 测试文件
    └── schemas.test.ts
```

## 核心数据模型

### Image（图片模型）
```typescript
interface Image {
  id: string;
  cloudinaryId: string;
  publicId: string;
  url: string;
  secureUrl: string;
  filename: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  groupId?: string;
  uploadedAt: Date;
  tags: string[];
}
```

### Group（分组模型）
```typescript
interface Group {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  imageCount: number;
}
```

### APIConfig（API配置模型）
```typescript
interface APIConfig {
  id: string;
  isEnabled: boolean;
  defaultScope: 'all' | 'groups';
  defaultGroups: string[];
  allowedParameters: APIParameter[];
  updatedAt: Date;
}
```

## 错误处理

系统提供了完整的错误类型定义和自定义错误类：

```typescript
// 错误类型枚举
enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CLOUDINARY_ERROR = 'CLOUDINARY_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  // ... 更多错误类型
}

// 使用自定义错误类
throw new ValidationError('数据验证失败', validationErrors);
throw new NotFoundError('Image', 'image-id');
throw new CloudinaryError('上传失败', details);
```

## 数据验证

使用Zod进行运行时数据验证：

```typescript
import { validateImage, safeValidateImage } from '@/types';

// 抛出异常的验证
try {
  const validImage = validateImage(imageData);
  // 使用验证后的数据
} catch (error) {
  // 处理验证错误
}

// 安全验证，返回结果
const result = safeValidateImage(imageData);
if (result.success) {
  // 使用 result.data
} else {
  // 处理 result.errors
}
```

## API类型

完整的API请求和响应类型定义：

```typescript
// 请求类型
interface ImageUploadRequest {
  file: File;
  groupId?: string;
  tags?: string[];
}

// 响应类型
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
}
```

## 工具函数

提供了多个实用的工具函数：

```typescript
import { 
  parseQueryToPagination,
  normalizeTags,
  generateId,
  isImageFile,
  formatFileSize 
} from '@/types';

// 解析查询参数
const pagination = parseQueryToPagination(req.query);

// 标准化标签
const cleanTags = normalizeTags(['  tag1  ', 'tag2', 'tag1']);

// 生成唯一ID
const newId = generateId();

// 检查文件类型
if (isImageFile(file)) {
  // 处理图片文件
}

// 格式化文件大小
const sizeText = formatFileSize(1024000); // "1 MB"
```

## 使用示例

### 在API路由中使用

```typescript
import { validateImageUploadRequest, ImageUploadResponse } from '@/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const requestData = validateImageUploadRequest({
      groupId: formData.get('groupId'),
      tags: formData.getAll('tags')
    });
    
    // 处理上传逻辑
    const image = await uploadImage(file, requestData);
    
    return Response.json({
      success: true,
      data: { image, message: '上传成功' },
      timestamp: new Date()
    } as ImageUploadResponse);
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({
        success: false,
        error: error.toJSON()
      }, { status: 400 });
    }
    // 处理其他错误
  }
}
```

### 在React组件中使用

```typescript
import { Group, Image, safeValidateGroup } from '@/types';

function GroupForm({ onSubmit }: { onSubmit: (group: Group) => void }) {
  const handleSubmit = (formData: FormData) => {
    const groupData = {
      name: formData.get('name'),
      description: formData.get('description'),
      // ... 其他字段
    };
    
    const result = safeValidateGroup(groupData);
    if (result.success) {
      onSubmit(result.data);
    } else {
      // 显示验证错误
      console.error(result.errors);
    }
  };
  
  // 渲染表单
}
```

## 测试

类型系统包含完整的测试套件，运行测试：

```bash
npm test src/types/__tests__/schemas.test.ts
```

测试覆盖了：
- 所有数据模型的验证
- 错误处理机制
- 工具函数的功能
- 边界情况和异常处理

## 最佳实践

1. **始终使用类型验证**：在处理外部数据时，始终使用验证函数
2. **优先使用安全验证**：在不确定数据来源时，使用`safeValidate*`函数
3. **合理使用错误类**：根据错误类型使用相应的错误类
4. **保持类型一致性**：确保前后端使用相同的类型定义
5. **及时更新测试**：修改类型定义时，同步更新测试用例

## 扩展指南

如需添加新的数据模型或验证规则：

1. 在`models.ts`中定义接口
2. 在`schemas.ts`中添加Zod验证模式
3. 在`validators.ts`中添加验证函数
4. 在`api.ts`中定义相关的API类型
5. 在`__tests__/`中添加测试用例
6. 更新`index.ts`导出新类型