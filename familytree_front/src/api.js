import axios from 'axios'

// Split hosting (Cloudflare Pages + Render) bakes the backend URL in at build time via VITE_API_BASE_URL.
// Desktop (Electron loads dist/ from file://) and `npm run dev` talk to the local backend Electron spawns.
// Docker: the backend serves this page, so requests stay on the same origin.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (window.location.protocol === 'file:' || import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')

// The access token arrives once as ?token=… (Electron does this on every launch; a hosted install shares a link).
// Remember it so a hosted user doesn't need the link again in this browser.
const TOKEN_STORAGE_KEY = 'familytree_api_token'
const token = (() => {
  const fromUrl = new URLSearchParams(window.location.search).get('token')
  if (fromUrl) {
    // Drop it from the address bar so it doesn't linger in history, bookmarks or copied links.
    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    window.history.replaceState(null, '', url)
  }
  try {
    if (fromUrl) window.localStorage.setItem(TOKEN_STORAGE_KEY, fromUrl)
    return fromUrl || window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return fromUrl
  }
})()

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: token ? { 'X-FamilyTree-Token': token } : {},
})

// Human-readable reason from a failed request: {"error": "..."} or DRF field errors {"field": ["..."]}.
export function describeError(error) {
  const data = error.response?.data
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') return Object.values(data).flat().join(' ')
  return error.message
}
