/**
 * 生成唯一ID
 * 使用时间戳+随机数+计数器确保唯一性
 */
let counter = 0

export function generateId(): string {
  counter = (counter + 1) % 10000
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  const count = counter.toString(36).padStart(3, '0')
  return `${timestamp}${random}${count}`
}
