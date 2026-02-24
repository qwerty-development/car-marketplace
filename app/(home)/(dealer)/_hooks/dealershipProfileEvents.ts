type Listener = () => void

const listeners = new Set<Listener>()

export const onDealershipProfileRefresh = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const notifyDealershipProfileUpdated = () => {
  listeners.forEach(listener => {
    try {
      listener()
    } catch (error) {
      console.error('Error notifying dealership profile listener:', error)
    }
  })
}

