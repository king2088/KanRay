/**
 * 安全的localStorage操作
 * 处理容量超限和其他错误
 */

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error(`[Storage] save failed: ${key}`, e)
    // 如果是容量超限，尝试清理旧数据
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Storage] localStorage is full, please clean up old data')
    }
    return false
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.error(`[Storage] read failed: ${key}`, e)
    return null
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch (e) {
    console.error(`[Storage] remove failed: ${key}`, e)
    return false
  }
}
