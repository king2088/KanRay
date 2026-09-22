/**
 * 安全的localStorage操作
 * 处理容量超限和其他错误
 */

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (e) {
    console.error(`[Storage] 保存失败: ${key}`, e)
    // 如果是容量超限，尝试清理旧数据
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('[Storage] localStorage已满，请清理旧数据')
    }
    return false
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    console.error(`[Storage] 读取失败: ${key}`, e)
    return null
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch (e) {
    console.error(`[Storage] 删除失败: ${key}`, e)
    return false
  }
}
