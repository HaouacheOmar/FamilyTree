import { useEffect, useState } from 'react'
import { api } from './api'
import { getBirthdayAge } from './birthdays.mjs'
import { PersonButton } from './BirthdayPanels'

// Stats, today's birthdays and recent timeline events. dataVersion: see RelationshipEditor.
export default function Dashboard({ todayPeople, dataVersion, onOpenPerson, copy, toolsCopy, birthdayCopy }) {
  const [stats, setStats] = useState(null)
  const [timelineItems, setTimelineItems] = useState([])

  useEffect(() => {
    if (dataVersion === 0) return
    let isCurrent = true
    Promise.all([
      api.get('/api/stats/', { timeout: 4000 }),
      api.get('/api/timeline/', { timeout: 4000 }),
    ])
      .then(([statsRes, timelineRes]) => {
        if (!isCurrent) return
        setStats(statsRes.data)
        setTimelineItems((timelineRes.data || []).slice(-8).reverse())
      })
      .catch(error => console.error(error))
    return () => { isCurrent = false }
  }, [dataVersion])

  return (
    <section className="dashboard-grid">
      <div className="palette-group">
        <p className="palette-title">{copy.statsTitle}</p>
        {stats ? (
          <dl className="stat-list">
            {[
              [copy.totalPeople, stats.total_people ?? 0],
              [copy.livingPeople, stats.living_people ?? 0],
              [copy.deceasedPeople, stats.deceased_people ?? 0],
              [copy.averageAge, stats.average_age ?? '—'],
              [copy.oldestAge, stats.oldest_age ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="dashboard-empty">—</div>
        )}
      </div>

      <div className="palette-group">
        <p className="palette-title">{birthdayCopy.title}</p>
        {todayPeople.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{birthdayCopy.empty}</div>
        ) : (
          <div className="birthday-list-card">
            {todayPeople.map(person => {
              const age = getBirthdayAge(person)
              return (
                <PersonButton
                  key={person.id}
                  person={person}
                  className="birthday-list-item"
                  meta={`${person.birth_date || '—'}${age ? ` · ${age}` : ''}`}
                  onOpen={onOpenPerson}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="palette-group">
        <p className="palette-title">{copy.timelineTitle}</p>
        {timelineItems.length === 0 ? (
          <div className="dashboard-empty">{copy.timelineEmpty}</div>
        ) : (
          <div className="timeline-list">
            {timelineItems.map((event, index) => (
              <div key={`${event.person_id}-${event.type}-${event.date}-${index}`} className="timeline-item">
                <time dateTime={event.date}>{event.date}</time>
                <span>{(event.type === 'death' ? toolsCopy.timelineDeath : toolsCopy.timelineBirth).replace('{name}', event.person_name)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
