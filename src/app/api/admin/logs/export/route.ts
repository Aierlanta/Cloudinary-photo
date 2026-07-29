// /api/admin/logs/export 的实际处理逻辑位于 ../route.ts，
// 其 POST 处理器依据请求 pathname 分发到 exportLogs。
// 这里直接复用该处理器，使 /export 路径在 App Router 中真正可达。
export { POST } from '../route';

export const dynamic = 'force-dynamic';
