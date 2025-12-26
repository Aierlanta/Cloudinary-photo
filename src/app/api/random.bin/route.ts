/**
 * 兼容 vscode-background-cover 的“静态图片 URL 落盘缓存”策略：
 * - 插件会根据 URL path 的“文件扩展名”判断是否是静态图片（如 .jpg/.png/.webp），若判定为静态则命中本地缓存不再重新下载。
 * - /api/random 没有扩展名，在插件的新逻辑下可能会被当作 .jpg（静态）从而缓存，导致失去随机性。
 *
 * 因此我们提供 /api/random.bin：带一个“非图片扩展名”，让插件判定为非静态资源，从而每次都重新拉取。
 *
 * 备注：实现上直接复用 /api/random 的逻辑，保证行为一致（筛选参数、response=true、Telegram 直出等）。
 */

export { GET, dynamic } from '../random/route';


