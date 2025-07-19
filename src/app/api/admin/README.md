# 管理API端点文档

本文档描述了随机图片API系统的管理端点，这些端点仅供内置管理面板使用。

## 认证

所有管理API端点都需要管理员认证。支持以下认证方式：

1. **Authorization Bearer Token**
   ```
   Authorization: Bearer <admin_password>
   ```

2. **X-Admin-Password 头**
   ```
   X-Admin-Password: <admin_password>
   ```

3. **查询参数（仅用于测试）**
   ```
   ?admin_password=<admin_password>
   ```

## 图片管理 API

### GET /api/admin/images
获取图片列表，支持分页和筛选。

**查询参数：**
- `page` (number, 可选): 页码，默认为1
- `limit` (number, 可选): 每页数量，默认为20，最大100
- `groupId` (string, 可选): 按分组筛选
- `dateFrom` (string, 可选): 开始日期筛选
- `dateTo` (string, 可选): 结束日期筛选
- `sortBy` (string, 可选): 排序字段，可选值：uploadedAt, filename, bytes
- `sortOrder` (string, 可选): 排序方向，可选值：asc, desc

**响应示例：**
```json
{
  "success": true,
  "data": {
    "images": {
      "data": [...],
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/admin/images
上传新图片。

**请求体（multipart/form-data）：**
- `file` (File, 必需): 图片文件
- `groupId` (string, 可选): 分组ID
- `tags` (string, 可选): 标签，JSON数组格式

**响应示例：**
```json
{
  "success": true,
  "data": {
    "image": {...},
    "message": "图片上传成功"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### DELETE /api/admin/images/[id]
删除指定图片。

**响应示例：**
```json
{
  "success": true,
  "data": {
    "message": "图片删除成功",
    "deletedId": "img_000001"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 分组管理 API

### GET /api/admin/groups
获取所有分组列表。

**响应示例：**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "grp_000001",
        "name": "自然风景",
        "description": "自然风景图片",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "imageCount": 25
      }
    ]
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### POST /api/admin/groups
创建新分组。

**请求体：**
```json
{
  "name": "分组名称",
  "description": "分组描述（可选）"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "group": {...}
  },
  "message": "分组创建成功",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/admin/groups/[id]
更新分组信息。

**请求体：**
```json
{
  "name": "新分组名称（可选）",
  "description": "新分组描述（可选）"
}
```

### DELETE /api/admin/groups/[id]
删除分组。

**响应示例：**
```json
{
  "success": true,
  "data": {
    "message": "分组删除成功",
    "deletedId": "grp_000001",
    "affectedImages": 25
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## API配置管理

### GET /api/admin/config
获取当前API配置和使用信息。

**响应示例：**
```json
{
  "success": true,
  "data": {
    "config": {
      "id": "default",
      "isEnabled": true,
      "defaultScope": "all",
      "defaultGroups": [],
      "allowedParameters": [
        {
          "name": "category",
          "type": "group",
          "allowedValues": ["nature", "city"],
          "mappedGroups": ["grp_000001", "grp_000002"],
          "isEnabled": true
        }
      ],
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "apiInfo": {
      "baseUrl": "https://your-app.replit.app/api/random",
      "examples": [
        {
          "title": "获取随机图片",
          "url": "https://your-app.replit.app/api/random",
          "description": "获取一张随机图片"
        },
        {
          "title": "按category筛选",
          "url": "https://your-app.replit.app/api/random?category=nature",
          "description": "获取category为\"nature\"的随机图片"
        }
      ],
      "availableGroups": [...]
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/admin/config
更新API配置。

**请求体：**
```json
{
  "isEnabled": true,
  "defaultScope": "all",
  "defaultGroups": ["grp_000001"],
  "allowedParameters": [
    {
      "name": "category",
      "type": "group",
      "allowedValues": ["nature", "city"],
      "mappedGroups": ["grp_000001", "grp_000002"],
      "isEnabled": true
    }
  ]
}
```

## 错误处理

所有API端点都使用统一的错误响应格式：

```json
{
  "success": false,
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "错误描述",
    "details": "详细错误信息（可选）",
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**错误类型：**
- `VALIDATION_ERROR` (400): 请求参数验证失败
- `UNAUTHORIZED` (401): 认证失败
- `NOT_FOUND` (404): 资源不存在
- `INTERNAL_ERROR` (500): 服务器内部错误

## 文件上传限制

- 支持的文件类型：image/*
- 最大文件大小：10MB
- 支持的格式：JPEG, PNG, GIF, WebP等

## 数据验证

所有输入数据都经过严格验证：
- 分组名称：1-100个字符
- 分组描述：最多500个字符
- 参数名称：1-50个字符
- 标签：每个标签1-50个字符，最多20个标签
- ID格式：非空字符串

## 使用示例

### 上传图片到指定分组
```bash
curl -X POST \
  -H "X-Admin-Password: your_password" \
  -F "file=@image.jpg" \
  -F "groupId=grp_000001" \
  -F "tags=[\"nature\",\"landscape\"]" \
  https://your-app.replit.app/api/admin/images
```

### 创建新分组
```bash
curl -X POST \
  -H "X-Admin-Password: your_password" \
  -H "Content-Type: application/json" \
  -d '{"name":"城市风景","description":"城市建筑和街景图片"}' \
  https://your-app.replit.app/api/admin/groups
```

### 配置API参数
```bash
curl -X PUT \
  -H "X-Admin-Password: your_password" \
  -H "Content-Type: application/json" \
  -d '{
    "allowedParameters": [
      {
        "name": "style",
        "type": "custom",
        "allowedValues": ["modern", "vintage"],
        "mappedGroups": ["grp_000001"],
        "isEnabled": true
      }
    ]
  }' \
  https://your-app.replit.app/api/admin/config
```