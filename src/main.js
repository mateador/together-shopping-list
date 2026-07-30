import './style.css'
import { registerSW } from 'virtual:pwa-register'
import * as api from './api.js'
import * as local from './local.js'

registerSW({ immediate: true })

const app = document.getElementById('app')

let disconnectLive = null
let currentState = { list: null, items: [] }
let connectionStatus = 'connecting' // 'connecting' | 'live' | 'reconnecting' | 'polling'

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// ---------- Onboarding ----------

async function renderOnboarding() {
  app.innerHTML = `
    <div class="onboarding">
      <div>
        <h1>Together</h1>
        <p>One shopping list, shared live between you and your household.</p>
      </div>

      <div class="onboarding-card">
        <h2>Start a new list</h2>
        <p style="font-size:0.85rem;margin:0 0 0.5rem">Do this once — you'll get a code to share.</p>
        <button class="primary-btn" id="create-btn" style="width:100%">Create a shared list</button>
      </div>

      <div class="divider">— or —</div>

      <div class="onboarding-card">
        <h2>Join an existing list</h2>
        <p style="font-size:0.85rem;margin:0 0 0.5rem">Enter the code your household already has.</p>
        <div class="onboarding-row">
          <input class="code-input" id="join-code" placeholder="ABC123" maxlength="6" autocomplete="off" />
          <button class="primary-btn" id="join-btn">Join</button>
        </div>
        <div class="error-text" id="join-error" style="display:none"></div>
      </div>
    </div>
  `

  document.getElementById('create-btn').addEventListener('click', async (e) => {
    e.target.disabled = true
    e.target.textContent = 'Creating…'
    const { code } = await api.createHousehold()
    local.saveCode(code)
    await promptForName()
    boot()
  })

  document.getElementById('join-btn').addEventListener('click', async () => {
    const codeInput = document.getElementById('join-code')
    const errorEl = document.getElementById('join-error')
    const code = codeInput.value.trim().toUpperCase()
    if (!code) return
    const exists = await api.checkHousehold(code)
    if (!exists) {
      errorEl.textContent = "That code doesn't match a list. Double-check with whoever shared it."
      errorEl.style.display = 'block'
      return
    }
    local.saveCode(code)
    await promptForName()
    boot()
  })
}

async function promptForName() {
  if (local.getDisplayName()) return
  const name = window.prompt("What should show up as when you add items? (e.g. your first name)")
  if (name && name.trim()) {
    local.saveDisplayName(name.trim())
  }
}

// ---------- Main list view ----------

function statusLabel(status) {
  switch (status) {
    case 'live': return 'Live'
    case 'reconnecting': return 'Reconnecting…'
    case 'polling': return 'Syncing (delayed)'
    default: return 'Connecting…'
  }
}

function renderList() {
  const code = local.getSavedCode()
  const items = currentState.items || []

  app.innerHTML = `
    <div class="header">
      <div>
        <h1>Together</h1>
        <div class="subtitle">List for ${currentState.list ? currentState.list.date : '…'}</div>
      </div>
      <div class="status-pill ${connectionStatus}">
        <div class="status-dot"></div>
        ${statusLabel(connectionStatus)}
      </div>
    </div>

    <form class="add-form" id="add-form">
      <input type="text" id="item-input" placeholder="Add an item — e.g. Milk" autocomplete="off" />
      <button type="submit">Add</button>
    </form>

    ${
      items.length
        ? `<div class="item-list">${items.map(itemRowHTML).join('')}</div>`
        : `<div class="empty-state">List's empty.<br/>Add the first thing you need.</div>`
    }

    <button class="close-list-btn" id="close-list-btn" ${items.length === 0 ? 'disabled' : ''}>
      Finished shopping — close this list
    </button>

    <div class="share-note">
      Share this code so they can join: <span class="code">${code}</span>
    </div>
  `

  document.getElementById('add-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('item-input')
    const name = input.value.trim()
    if (!name) return
    input.value = ''
    const state = await api.addItem(code, name, local.getDisplayName() || null)
    currentState = state
    renderList()
  })

  document.getElementById('close-list-btn').addEventListener('click', async () => {
    if (!confirm('Close this list and start a fresh one?')) return
    const state = await api.closeList(code)
    currentState = state
    renderList()
  })

  app.querySelectorAll('.item-row').forEach((row) => {
    const id = row.dataset.id
    row.querySelector('.item-checkbox').addEventListener('click', async () => {
      const item = currentState.items.find((i) => i.id === id)
      const state = await api.setItemChecked(code, id, !item.checked)
      currentState = state
      renderList()
    })
    row.querySelector('.item-delete').addEventListener('click', async () => {
      const state = await api.deleteItem(code, id)
      currentState = state
      renderList()
    })
  })
}

function itemRowHTML(item) {
  return `
    <div class="item-row" data-id="${item.id}">
      <button class="item-checkbox ${item.checked ? 'checked' : ''}" aria-label="Toggle checked">
        ${item.checked ? '✓' : ''}
      </button>
      <div class="item-name ${item.checked ? 'checked' : ''}">${escapeHtml(item.name)}</div>
      ${item.added_by ? `<div class="item-added-by">${escapeHtml(item.added_by)}</div>` : ''}
      <button class="item-delete" aria-label="Remove item">✕</button>
    </div>
  `
}

// ---------- Boot ----------

function boot() {
  const code = local.getSavedCode()
  if (!code) {
    renderOnboarding()
    return
  }

  if (disconnectLive) disconnectLive()

  disconnectLive = api.connectLive(
    code,
    (state) => {
      currentState = state
      renderList()
    },
    (status) => {
      connectionStatus = status
      // Only re-render the pill area cheaply if we already have a list rendered
      if (currentState.list) renderList()
    }
  )

  // Render an initial (possibly empty) shell immediately while the socket connects
  renderList()
}

boot()
