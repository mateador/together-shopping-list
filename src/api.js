const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function createHousehold() {
  return request('/api/households', { method: 'POST' })
}

export async function checkHousehold(code) {
  try {
    await request(`/api/households/${code}`)
    return true
  } catch {
    return false
  }
}

export async function getList(code) {
  return request(`/api/households/${code}/list`)
}

export async function addItem(code, name, addedBy) {
  return request(`/api/households/${code}/items`, {
    method: 'POST',
    body: JSON.stringify({ name, added_by: addedBy })
  })
}

export async function setItemChecked(code, itemId, checked) {
  return request(`/api/households/${code}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ checked })
  })
}

export async function deleteItem(code, itemId) {
  return request(`/api/households/${code}/items/${itemId}`, { method: 'DELETE' })
}

export async function closeList(code) {
  return request(`/api/households/${code}/list/close`, { method: 'POST' })
}

export async function getHistory(code) {
  return request(`/api/households/${code}/history`)
}

/**
 * Live connection to a household's list. Prefers WebSocket for instant
 * updates; falls back to polling every 4s if the socket can't connect or
 * drops and won't reconnect (e.g. corporate wifi blocking WebSocket).
 */
export function connectLive(code, onState, onStatusChange) {
  let ws = null
  let pollTimer = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  let stopped = false

  function startPolling() {
    if (pollTimer) return
    onStatusChange('polling')
    pollTimer = setInterval(async () => {
      try {
        const state = await getList(code)
        onState(state)
      } catch {
        // ignore transient errors, next poll will retry
      }
    }, 4000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function connectWs() {
    if (stopped) return
    ws = new WebSocket(`${WS_BASE}/ws/${code}`)

    ws.onopen = () => {
      reconnectAttempts = 0
      stopPolling()
      onStatusChange('live')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'state') {
          onState(data)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      if (stopped) return
      onStatusChange('reconnecting')
      startPolling() // keep data fresh while we try to get the socket back
      reconnectAttempts += 1
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000)
      reconnectTimer = setTimeout(connectWs, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  connectWs()

  return function disconnect() {
    stopped = true
    stopPolling()
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (ws) ws.close()
  }
}
