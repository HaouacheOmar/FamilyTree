import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from './icons'
import { popover } from './motionPresets'
import {
  BACKGROUND_SWATCHES, LABEL_DENSITY_OPTIONS, ORIENTATION_OPTIONS, SHAPE_OPTIONS, useCloseOnOutsideClick,
} from './hooks'

const SHAPE_LABEL_KEYS = {
  circle: 'shapeCircle', square: 'shapeSquare', rounded: 'shapeRounded',
  diamond: 'shapeDiamond', hexagon: 'shapeHexagon', capsule: 'shapeCapsule',
}
const LABEL_DENSITY_COPY_KEYS = { all: 'all', 'hide-deep': 'hideDeep', 'names-only': 'namesOnly' }

function getShapeLabel(shape, copy) {
  return copy[SHAPE_LABEL_KEYS[shape]] || shape
}

function getShapeIconClass(shape) {
  return `shape-icon shape-${SHAPE_LABEL_KEYS[shape] ? shape : 'circle'}`
}

// Appearance palette: background, node shape, orientation, 2D/3D mode. State lives in useTreePreferences.
export default function TreeControls({ preferences, setPreference, resetPreferences, copy, renderModeCopy, labelDensityCopy }) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(true)
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false)
  const shapeMenuRef = useRef(null)
  useCloseOnOutsideClick(shapeMenuRef, setIsShapeMenuOpen)

  return (
    <section className={`tree-controls ${isPaletteOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="advanced-card-toggle tree-controls-toggle"
        onClick={() => setIsPaletteOpen(prev => !prev)}
        aria-expanded={isPaletteOpen}
        title={isPaletteOpen ? copy.paletteToggleClose : copy.paletteToggleOpen}
        aria-label={isPaletteOpen ? copy.paletteToggleClose : copy.paletteToggleOpen}
      >
        <span className={`advanced-card-toggle-icon ${!isPaletteOpen ? 'is-collapsed' : ''}`}><ChevronDown /></span>
      </button>

      <div className="palette-group">
        <p className="palette-title">{copy.backgroundPalette}</p>
        <div className="palette-row">
          {BACKGROUND_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch-btn ${preferences.backgroundColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              aria-label={`Background ${color}`}
              onClick={() => setPreference('backgroundColor', color)}
            />
          ))}
        </div>
        <div className="palette-color-picker-row">
          <label className="palette-color-picker-label">{copy.customColor}</label>
          <input
            type="color"
            value={preferences.backgroundColor}
            className="palette-color-picker"
            onChange={(e) => setPreference('backgroundColor', e.target.value)}
          />
        </div>
      </div>

      <div className="palette-group">
        <p className="palette-title">{copy.shapePalette}</p>
        <div className="palette-row">
          <div className="dropdown-menu shape-dropdown" ref={shapeMenuRef}>
            <button
              type="button"
              className="dropdown-trigger shape-trigger"
              onClick={() => setIsShapeMenuOpen(prev => !prev)}
            >
              <span className={getShapeIconClass(preferences.nodeShape)} aria-hidden="true" />
              <span>{getShapeLabel(preferences.nodeShape, copy)}</span>
              <span className="dropdown-caret"><ChevronDown size={14} /></span>
            </button>

            <AnimatePresence>
              {isShapeMenuOpen && (
                <motion.div className="dropdown-panel shape-panel" role="listbox" aria-label={copy.shapePalette} {...popover}>
                  {SHAPE_OPTIONS.map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      role="option"
                      aria-selected={preferences.nodeShape === shape}
                      className={`dropdown-option ${preferences.nodeShape === shape ? 'active' : ''}`}
                      onClick={() => {
                        setPreference('nodeShape', shape)
                        setIsShapeMenuOpen(false)
                      }}
                    >
                      <span className={getShapeIconClass(shape)} aria-hidden="true" />
                      <span>{getShapeLabel(shape, copy)}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="palette-group">
        <p className="palette-title">{copy.orientationPalette}</p>
        <div className="palette-row">
          {ORIENTATION_OPTIONS.map((orientation) => (
            <button
              key={orientation}
              type="button"
              className={`shape-btn ${preferences.treeOrientation === orientation ? 'active' : ''}`}
              onClick={() => setPreference('treeOrientation', orientation)}
            >
              <span>{orientation === 'vertical' ? copy.orientationVertical : copy.orientationHorizontal}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="palette-group">
        <p className="palette-title">{renderModeCopy.title}</p>
        <div className="palette-row">
          <div className="render-mode-toggle-wrap">
            <button
              type="button"
              className={`render-mode-toggle ${preferences.treeRenderMode === '3d' ? 'is-on' : ''}`}
              onClick={() => setPreference('treeRenderMode', preferences.treeRenderMode === '3d' ? '2d' : '3d')}
              aria-label={renderModeCopy.title}
              aria-pressed={preferences.treeRenderMode === '3d'}
            >
              <span className="render-mode-label render-mode-label-left">{renderModeCopy.mode2d}</span>
              <span className="render-mode-label render-mode-label-right">{renderModeCopy.mode3d}</span>
              <span className="render-mode-toggle-knob" />
            </button>
          </div>
        </div>
        {preferences.treeRenderMode === '3d' && (
          <>
            <p className="palette-title palette-subtitle">{labelDensityCopy.title}</p>
            <div className="palette-row">
              {LABEL_DENSITY_OPTIONS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`shape-btn ${preferences.threeLabelDensity === mode ? 'active' : ''}`}
                  onClick={() => setPreference('threeLabelDensity', mode)}
                >
                  <span>{labelDensityCopy[LABEL_DENSITY_COPY_KEYS[mode]]}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="palette-reset-row">
          <button type="button" className="btn-reset-theme" onClick={resetPreferences}>
            {copy.resetTheme}
          </button>
        </div>
      </div>
    </section>

  )
}
