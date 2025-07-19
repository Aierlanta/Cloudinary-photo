# 随机图片API端点

## 概述

`/api/random` 是系统唯一的公开API端点，用于获取随机图片。该端点直接返回图片文件，而不是JSON数据。

## 基本用法

### 获取随机图片

```
GET /api/random
```

**响应:**
- 成功时直接返回图片文件
- 失败时返回相应的HTTP状态码和错误信息

### 响应头

成功响应包含以下头信息：

- `Content-Type`: 图片MIME类型 (如 `image/jpeg`, `image/png`)
- `Content-Length`: 图片文件大小
- `Cache-Control`: 缓存控制 (`public, max-age=3600`)
- `X-Image-Id`: 图片的唯一标识符
- `X-Image-Filename`: 图片的原始文件名

## 参数化请求

API支持通过查询参数来筛选图片范围。可用的参数由管理员在管理面板中配置。

### 示例参数

```
GET /api/random?category=nature
GET /api/random?category=city&size=large
GET /api/random?type=landscape
```

**注意:** 
- 只有管理员配置的参数才会被接受
- 未配置的参数将导致400错误
- 参数值必须在管理员设置的允许范围内

## 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功返回图片 |
| 400 | 请求参数无效 |
| 404 | 没有找到符合条件的图片 |
| 500 | 服务器内部错误 |
| 503 | API服务暂时不可用 |

## 使用示例

### HTML中使用

```html
<img src="/api/random" alt="随机图片" />
<img src="/api/random?category=nature" alt="自然风景" />
```

### JavaScript中使用

```javascript
// 获取随机图片URL
const imageUrl = '/api/random';

// 带参数的请求
const categoryImageUrl = '/api/random?category=nature';

// 使用fetch获取图片
fetch('/api/random')
  .then(response => {
    if (response.ok) {
      return response.blob();
    }
    throw new Error('获取图片失败');
  })
  .then(blob => {
    const imageUrl = URL.createObjectURL(blob);
    document.getElementById('myImage').src = imageUrl;
  })
  .catch(error => {
    console.error('错误:', error);
  });
```

### cURL示例

```bash
# 获取随机图片
curl -o random_image.jpg "http://localhost:3000/api/random"

# 带参数获取图片
curl -o nature_image.jpg "http://localhost:3000/api/random?category=nature"

# 查看响应头
curl -I "http://localhost:3000/api/random"
```

## 缓存

API响应包含缓存头，建议客户端缓存图片以提高性能：

- 缓存时间：1小时 (`max-age=3600`)
- 缓存类型：公共缓存 (`public`)

## 限制

- 图片大小：取决于管理员上传的图片
- 请求频率：建议合理使用，避免过于频繁的请求
- 参数数量：支持多个参数组合

## 错误处理

当请求失败时，API会返回相应的HTTP状态码和错误信息：

```javascript
fetch('/api/random?invalid=param')
  .then(response => {
    if (!response.ok) {
      if (response.status === 400) {
        console.error('请求参数无效');
      } else if (response.status === 404) {
        console.error('没有找到图片');
      } else if (response.status === 503) {
        console.error('API服务暂时不可用');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return response.blob();
  })
  .catch(error => {
    console.error('请求失败:', error);
  });
```

## 配置管理

API的参数配置通过管理面板进行：

1. 登录管理面板
2. 进入"API配置"页面
3. 添加或修改允许的参数
4. 设置参数值与图片分组的映射关系
5. 配置默认访问范围

## 性能优化建议

1. **使用缓存**: 利用HTTP缓存头减少重复请求
2. **合理的请求频率**: 避免过于频繁的API调用
3. **参数化请求**: 使用参数获取特定类型的图片，减少不必要的随机性
4. **错误处理**: 实现适当的错误处理和重试机制

## 监控和日志

API会记录以下信息：

- 请求参数和响应状态
- 错误信息和异常
- 性能指标（响应时间等）

管理员可以通过服务器日志监控API的使用情况和性能表现。