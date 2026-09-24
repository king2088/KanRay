const DEFAULT_DELAY = 200

let pendingCount = 0
let visible = false
let delayTimer = null
let delay = DEFAULT_DELAY
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn(visible))
}

function schedule() {
  if (visible || delayTimer) return
  delayTimer = setTimeout(() => {
    delayTimer = null
    if (pendingCount > 0) {
      visible = true
      emit()
    }
  }, delay)
}

export const topLoading = {
  get TOP_LOADING_DELAY() {
    return delay
  },

  start() {
    if (pendingCount === 0) schedule()
    pendingCount++
  },

  done() {
    pendingCount = Math.max(0, pendingCount - 1)
    if (pendingCount === 0) {
      if (delayTimer) {
        clearTimeout(delayTimer)
        delayTimer = null
      }
      if (visible) {
        visible = false
        emit()
      }
    }
  },

  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  reset() {
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    pendingCount = 0
    visible = false
  },

  setDelay(ms) {
    delay = ms
  },
}