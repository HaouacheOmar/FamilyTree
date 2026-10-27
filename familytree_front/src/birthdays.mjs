// Birthday math shared by the React UI and Electron's main process (electron.js require()s this file),
// so it must stay plain JavaScript with no browser or Node specific imports.

// Local calendar date as YYYY-MM-DD (toISOString would give the UTC date).
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Birthday in a given year; Feb 29 falls on Feb 28 in non-leap years.
function birthdayInYear(year, month, day) {
  const candidate = new Date(year, month - 1, day)
  return candidate.getMonth() === month - 1 ? candidate : new Date(year, month - 1, day - 1)
}

// Days until the next birthday (0 = today), or null for unknown dates and deceased people.
export function getDaysUntilBirthday(person, fromDate = new Date()) {
  if (!person?.birth_date || person.birth_date.length < 10 || person.death_date) return null

  const birthMonth = Number.parseInt(person.birth_date.slice(5, 7), 10)
  const birthDay = Number.parseInt(person.birth_date.slice(8, 10), 10)
  if (!Number.isFinite(birthMonth) || !Number.isFinite(birthDay)) return null

  const startOfToday = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  const thisYear = birthdayInYear(fromDate.getFullYear(), birthMonth, birthDay)
  const next = thisYear >= startOfToday ? thisYear : birthdayInYear(fromDate.getFullYear() + 1, birthMonth, birthDay)
  return Math.round((next - startOfToday) / (1000 * 60 * 60 * 24))
}

// Age reached on this year's birthday.
export function getBirthdayAge(person) {
  const birthYear = Number.parseInt(person?.birth_date?.slice(0, 4), 10)
  return Number.isFinite(birthYear) ? new Date().getFullYear() - birthYear : null
}

const sortName = person => `${person.last_name || ''} ${person.first_name || ''}`.trim().toLowerCase()

// [{ person, daysUntil }] for birthdays within `maxDays` (today included), soonest first, then by name.
export function upcomingBirthdays(people, maxDays, fromDate = new Date()) {
  return people
    .map(person => ({ person, daysUntil: getDaysUntilBirthday(person, fromDate) }))
    .filter(entry => entry.daysUntil !== null && entry.daysUntil <= maxDays)
    .sort((left, right) => left.daysUntil - right.daysUntil || sortName(left.person).localeCompare(sortName(right.person)))
}
