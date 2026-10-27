// Motion presets: one place for how things move. Values mirror the --duration-* / --ease-out tokens in App.css.
// The whole app sits inside <MotionConfig reducedMotion="user">, so transforms are dropped for users who ask.

const easeOut = [0.22, 1, 0.36, 1]

// Gentle spring for things that appear (modal card, toasts): a hint of life, no wobble.
export const spring = { type: 'spring', bounce: 0.18, visualDuration: 0.32 }

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.22, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: 'easeIn' } }, // exits faster than entrances
}

// Dropdown menus: drop down a few pixels from their trigger.
export const popover = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.18, ease: easeOut } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12, ease: 'easeIn' } },
}

// Modal card: rises and settles while the backdrop fades.
export const dialog = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15, ease: 'easeIn' } },
}

// Panels that leave the page (dismissed birthday reminder).
export const collapseOut = {
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
}

// Short lists (birthday chips): children fade up one after another.
export const staggerList = {
  animate: { transition: { staggerChildren: 0.04 } },
}
export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: easeOut } },
}

// Toasts slide in from the inline end (right in LTR, left in RTL).
export const toast = direction => ({
  initial: { opacity: 0, x: direction === 'rtl' ? -24 : 24 },
  animate: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: 'easeIn' } },
})
