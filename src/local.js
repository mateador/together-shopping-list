const CODE_KEY = 'together:household-code'
const NAME_KEY = 'together:display-name'

export function getSavedCode() {
  return localStorage.getItem(CODE_KEY)
}

export function saveCode(code) {
  localStorage.setItem(CODE_KEY, code.toUpperCase())
}

export function clearCode() {
  localStorage.removeItem(CODE_KEY)
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) || ''
}

export function saveDisplayName(name) {
  localStorage.setItem(NAME_KEY, name)
}
