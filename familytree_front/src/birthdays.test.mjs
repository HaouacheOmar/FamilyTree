// Run with: npm test
import assert from 'node:assert/strict'
import { getDaysUntilBirthday, localDateKey, upcomingBirthdays } from './birthdays.mjs'

const on = (y, m, d) => new Date(y, m - 1, d)
const born = (birth_date, extra = {}) => ({ birth_date, first_name: 'X', ...extra })

assert.equal(getDaysUntilBirthday(born('1990-10-08'), on(2026, 10, 8)), 0)
assert.equal(getDaysUntilBirthday(born('1990-10-09'), on(2026, 10, 8)), 1)
assert.equal(getDaysUntilBirthday(born('1990-10-07'), on(2026, 10, 8)), 364)
assert.equal(getDaysUntilBirthday(born('2000-02-29'), on(2026, 2, 28)), 0, 'leap-day birthday on Feb 28 in non-leap years')
assert.equal(getDaysUntilBirthday(born('2000-02-29'), on(2028, 2, 28)), 1, 'and on Feb 29 in leap years')
assert.equal(getDaysUntilBirthday(born('1990-10-08', { death_date: '2000-01-01' }), on(2026, 10, 8)), null)
assert.equal(getDaysUntilBirthday(born(null), on(2026, 10, 8)), null)
assert.equal(localDateKey(on(2026, 1, 5)), '2026-01-05')

const upcoming = upcomingBirthdays(
  [born('1990-10-20', { last_name: 'B' }), born('1990-10-08'), born('1990-10-20', { last_name: 'A' }), born('1990-12-01')],
  30,
  on(2026, 10, 8),
)
assert.deepEqual(upcoming.map(e => [e.daysUntil, e.person.last_name]), [[0, undefined], [12, 'A'], [12, 'B']])

console.log('birthdays: ok')
