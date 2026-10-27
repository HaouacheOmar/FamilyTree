import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Gift } from './icons'
import { collapseOut, staggerItem, staggerList } from './motionPresets'
import { getBirthdayAge, localDateKey, upcomingBirthdays } from './birthdays.mjs'

const WINDOW_OPTIONS = [7, 30]
const DISMISSED_STORAGE_KEY = 'familytree_birthday_reminder_dismissed'

function readFlag(key) {
  try {
    return Boolean(window.localStorage.getItem(key))
  } catch (error) {
    console.error(error)
    return false
  }
}

// Clickable person name with a small meta line. "birthday-chip" renders as a pill, anything else as a list row.
export function PersonButton({ person, className, meta, onOpen }) {
  const isChip = className === 'birthday-chip'
  return (
    <motion.button type="button" className={className} onClick={() => onOpen(person)} variants={staggerItem}>
      <span className={isChip ? undefined : 'birthday-list-name'}>{person.first_name} {person.last_name}</span>
      {meta ? <span className={isChip ? 'birthday-chip-age' : 'birthday-list-meta'}>{meta}</span> : null}
    </motion.button>
  )
}

export function BirthdayReminderPanel({ people, todayPeople, onOpenPerson, birthdayPanelCopy }) {
  const [windowDays, setWindowDays] = useState(7)
  const dismissedKey = `${DISMISSED_STORAGE_KEY}_${localDateKey()}_${windowDays}`
  const [isDismissed, setIsDismissed] = useState(() => readFlag(dismissedKey))
  useEffect(() => setIsDismissed(readFlag(dismissedKey)), [dismissedKey])

  const upcoming = upcomingBirthdays(people, windowDays).filter(entry => entry.daysUntil > 0)
  const isVisible = !isDismissed && (todayPeople.length > 0 || upcoming.length > 0)

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissedKey, '1')
    } catch (error) {
      console.error(error)
    }
    setIsDismissed(true)
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.section key="birthday-reminder" className="birthday-reminder-panel" aria-live="polite" {...collapseOut}>
          <div className="birthday-reminder-header">
            <div>
              <div className="birthday-reminder-title"><Gift size={18} /> {birthdayPanelCopy.title}</div>
              <div className="birthday-reminder-subtitle">
                {windowDays === 7 ? birthdayPanelCopy.next7 : birthdayPanelCopy.next30}
              </div>
            </div>
            <button type="button" className="birthday-reminder-dismiss" onClick={dismiss}>
              {birthdayPanelCopy.dismiss}
            </button>
          </div>
    
          <div className="birthday-reminder-range-switcher" role="tablist" aria-label={birthdayPanelCopy.rangeSelectorLabel}>
            {WINDOW_OPTIONS.map(days => (
              <button
                key={days}
                type="button"
                className={`birthday-reminder-range-btn ${windowDays === days ? 'active' : ''}`}
                onClick={() => setWindowDays(days)}
              >
                {days === 7 ? birthdayPanelCopy.range7 : birthdayPanelCopy.range30}
              </button>
            ))}
          </div>
    
          {todayPeople.length > 0 && (
            <div className="birthday-reminder-section">
              <div className="birthday-reminder-section-title">{birthdayPanelCopy.todayTitle}</div>
              <motion.div className="birthday-banner-list" variants={staggerList} initial="initial" animate="animate">
                {todayPeople.map(person => {
                  const age = getBirthdayAge(person)
                  return (
                    <PersonButton
                      key={person.id}
                      person={person}
                      className="birthday-chip"
                      meta={age ? `${birthdayPanelCopy.ageToday} ${age}` : null}
                      onOpen={onOpenPerson}
                    />
                  )
                })}
              </motion.div>
            </div>
          )}
    
          <div className="birthday-reminder-section">
            <div className="birthday-reminder-section-title">
              {birthdayPanelCopy.upcomingTitle} ({upcoming.length})
            </div>
            {upcoming.length === 0 ? (
              <div className="birthday-reminder-empty">{birthdayPanelCopy.empty}</div>
            ) : (
              <motion.div className="birthday-reminder-list" variants={staggerList} initial="initial" animate="animate">
                {upcoming.map(({ person, daysUntil }) => {
                  const age = getBirthdayAge(person)
                  return (
                    <PersonButton
                      key={person.id}
                      person={person}
                      className="birthday-reminder-item"
                      meta={`${birthdayPanelCopy.inDays.replace('{days}', daysUntil)}${age ? ` · ${age}` : ''}`}
                      onOpen={onOpenPerson}
                    />
                  )
                })}
              </motion.div>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
