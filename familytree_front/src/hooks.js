import { useEffect, useState } from 'react'

// Closes a dropdown (setOpen(false)) when a mousedown lands outside the element in `ref`.
export function useCloseOnOutsideClick(ref, setOpen) {
  useEffect(() => {
    const handleMouseDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [ref, setOpen])
}

// Tree canvas backgrounds: soft tints that keep tree-card text above 4.5:1.
export const BACKGROUND_SWATCHES = ['#FFFFFF', '#F7F4EE', '#EEF4F0', '#EEF3F8', '#FBF3E6', '#F5EEF2']
export const SHAPE_OPTIONS = ['circle', 'square', 'rounded', 'diamond', 'hexagon', 'capsule']
export const ORIENTATION_OPTIONS = ['vertical', 'horizontal']
export const RENDER_MODE_OPTIONS = ['2d', '3d']
export const LABEL_DENSITY_OPTIONS = ['all', 'hide-deep', 'names-only']

// name -> [localStorage key, allowed values or null for free text, default]
const PREFERENCES = {
  backgroundColor: ['familytree_background_color', null, BACKGROUND_SWATCHES[0]],
  nodeShape: ['familytree_node_shape', SHAPE_OPTIONS, SHAPE_OPTIONS[0]],
  treeOrientation: ['familytree_tree_orientation', ORIENTATION_OPTIONS, ORIENTATION_OPTIONS[0]],
  treeRenderMode: ['familytree_render_mode', RENDER_MODE_OPTIONS, RENDER_MODE_OPTIONS[0]],
  threeLabelDensity: ['familytree_3d_label_density', LABEL_DENSITY_OPTIONS, LABEL_DENSITY_OPTIONS[0]],
}
const DEFAULT_PREFERENCES = Object.fromEntries(Object.entries(PREFERENCES).map(([name, [, , fallback]]) => [name, fallback]))

function loadPreferences() {
  const loaded = { ...DEFAULT_PREFERENCES }
  try {
    Object.entries(PREFERENCES).forEach(([name, [key, allowed]]) => {
      const stored = window.localStorage.getItem(key)
      if (stored && (!allowed || allowed.includes(stored))) loaded[name] = stored
    })
  } catch (error) {
    console.error(error)
  }
  return loaded
}

// Tree look-and-feel settings, persisted in localStorage. Returns [preferences, setPreference, resetPreferences].
export function useTreePreferences() {
  const [preferences, setPreferences] = useState(loadPreferences)

  useEffect(() => {
    try {
      Object.entries(PREFERENCES).forEach(([name, [key]]) => window.localStorage.setItem(key, preferences[name]))
    } catch (error) {
      console.error(error)
    }
  }, [preferences])

  const setPreference = (name, value) => setPreferences(prev => ({ ...prev, [name]: value }))
  const resetPreferences = () => setPreferences(DEFAULT_PREFERENCES)
  return [preferences, setPreference, resetPreferences]
}
