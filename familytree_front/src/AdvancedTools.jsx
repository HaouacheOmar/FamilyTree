import { useEffect, useId, useState } from 'react'
import { api } from './api'
import { ChevronDown } from './icons'
import { getRelationshipStatusLabel, getRelationshipTypeLabel } from './i18n'

export const DEFAULT_FILTERS = {
  birth_from: '', birth_to: '', death_from: '', death_to: '',
  location: '', living: 'all', branch_root: '', branch_depth: '',
}
export const DEFAULT_RESULT_LIMIT = 400

const EMPTY_RELATIONSHIP_FORM = {
  person1: '', person2: '', relationship_type: 'MARRIAGE', status: 'ACTIVE',
  start_date: '', end_date: '', notes: '',
}
const RELATIONSHIP_TYPE_OPTIONS = ['MARRIAGE', 'PARTNER']
const RELATIONSHIP_STATUS_OPTIONS = ['ACTIVE', 'DIVORCED', 'SEPARATED', 'WIDOWED', 'ENDED']

// Collapsed by default so the tree stays near the top of the page (progressive disclosure).
function ToolCard({ title, toolsCopy, children }) {
  const [collapsed, setCollapsed] = useState(true)
  const bodyId = useId()
  const toggleLabel = `${collapsed ? toolsCopy.panelShow : toolsCopy.panelHide} ${title}`
  return (
    <div className={`palette-group advanced-tools-card ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="advanced-tools-card-header">
        <p className="palette-title">{title}</p>
        <button
          type="button"
          className="advanced-card-toggle"
          onClick={() => setCollapsed(prev => !prev)}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <span className={`advanced-card-toggle-icon ${collapsed ? 'is-collapsed' : ''}`}><ChevronDown /></span>
        </button>
      </div>
      <div id={bodyId} className="advanced-tools-card-body">
        <div className="advanced-tools-card-inner">{children}</div>
      </div>
    </div>
  )
}

function PersonOptions({ people, copy }) {
  return (
    <>
      <option value="">{copy.none}</option>
      {people.map(person => (
        <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
      ))}
    </>
  )
}

export function FiltersCard({
  filters, setFilters, smartSearch, setSmartSearch, resultLimit, setResultLimit, directoryPeople, copy, toolsCopy,
}) {
  const bindFilter = name => ({
    value: filters[name],
    onChange: event => setFilters(prev => ({ ...prev, [name]: event.target.value })),
  })
  const dateFilters = [
    ['birth_from', toolsCopy.filtersBirthFrom],
    ['birth_to', toolsCopy.filtersBirthTo],
    ['death_from', toolsCopy.filtersDeathFrom],
    ['death_to', toolsCopy.filtersDeathTo],
  ]

  return (
    <ToolCard title={toolsCopy.filtersTitle} toolsCopy={toolsCopy}>
      <div className="advanced-tools-fields">
        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersSmart}</span>
          <input type="checkbox" checked={smartSearch} onChange={event => setSmartSearch(event.target.checked)} />
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersLimit}</span>
          <input
            type="number"
            min="50"
            value={resultLimit}
            onChange={event => setResultLimit(Number.parseInt(event.target.value, 10) || DEFAULT_RESULT_LIMIT)}
            onBlur={() => setResultLimit(prev => Math.max(50, prev))}
          />
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersLiving}</span>
          <select {...bindFilter('living')}>
            <option value="all">{toolsCopy.filtersAll}</option>
            <option value="living">{toolsCopy.filtersLivingOnly}</option>
            <option value="deceased">{toolsCopy.filtersDeceasedOnly}</option>
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersLocation}</span>
          <input type="text" {...bindFilter('location')} />
        </label>

        {dateFilters.map(([name, label]) => (
          <label key={name} className="advanced-tools-field">
            <span>{label}</span>
            <input type="date" {...bindFilter(name)} />
          </label>
        ))}

        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersBranch}</span>
          <select {...bindFilter('branch_root')}>
            <PersonOptions people={directoryPeople} copy={copy} />
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.filtersBranchDepth}</span>
          <input type="number" min="1" max="10" {...bindFilter('branch_depth')} />
        </label>
      </div>

      <button
        type="button"
        className="btn-reset-theme"
        onClick={() => {
          setFilters(DEFAULT_FILTERS)
          setSmartSearch(true)
          setResultLimit(DEFAULT_RESULT_LIMIT)
        }}
      >
        {toolsCopy.filtersReset}
      </button>
    </ToolCard>
  )
}

// dataVersion: bumped by App after every data change; 0 means the backend is not up yet.
export function RelationshipEditor({ directoryPeople, dataVersion, onChanged, onError, copy, toolsCopy }) {
  const [relationships, setRelationships] = useState([])
  const [personFilter, setPersonFilter] = useState('')
  const [form, setForm] = useState(EMPTY_RELATIONSHIP_FORM)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (dataVersion === 0) return
    let isCurrent = true
    api.get('/api/relationships/', { timeout: 6000, params: personFilter ? { person: personFilter } : {} })
      .then(res => { if (isCurrent) setRelationships(res.data || []) })
      .catch(error => console.error(error))
    return () => { isCurrent = false }
  }, [personFilter, dataVersion])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setForm(EMPTY_RELATIONSHIP_FORM)
    setEditingId(null)
  }

  const startEditing = (relationship) => {
    setEditingId(relationship.id)
    setForm({
      person1: String(relationship.person1 || ''),
      person2: String(relationship.person2 || ''),
      relationship_type: relationship.relationship_type || 'MARRIAGE',
      status: relationship.status || 'ACTIVE',
      start_date: relationship.start_date || '',
      end_date: relationship.end_date || '',
      notes: relationship.notes || '',
    })
  }

  const submit = async () => {
    if (!form.person1 || !form.person2) {
      alert(toolsCopy.relationshipsSelectTwoPeople)
      return
    }
    const payload = {
      ...form,
      person1: Number.parseInt(form.person1, 10),
      person2: Number.parseInt(form.person2, 10),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    try {
      if (editingId) {
        await api.patch(`/api/relationships/${editingId}/`, payload)
      } else {
        await api.post('/api/relationships/', payload)
      }
      resetForm()
      await onChanged()
    } catch (error) {
      onError(error)
    }
  }

  const remove = async (relationshipId) => {
    if (!window.confirm(toolsCopy.relationshipsDeleteConfirm)) return
    try {
      await api.delete(`/api/relationships/${relationshipId}/`)
      await onChanged()
    } catch (error) {
      onError(error)
    }
  }

  return (
    <ToolCard title={toolsCopy.relationshipsTitle} toolsCopy={toolsCopy}>
      <div className="advanced-tools-fields">
        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsFilterPerson}</span>
          <select value={personFilter} onChange={event => setPersonFilter(event.target.value)}>
            <PersonOptions people={directoryPeople} copy={copy} />
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsPerson1}</span>
          <select name="person1" value={form.person1} onChange={handleChange}>
            <PersonOptions people={directoryPeople} copy={copy} />
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsPerson2}</span>
          <select name="person2" value={form.person2} onChange={handleChange}>
            <PersonOptions people={directoryPeople} copy={copy} />
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsType}</span>
          <select name="relationship_type" value={form.relationship_type} onChange={handleChange}>
            {RELATIONSHIP_TYPE_OPTIONS.map(value => <option key={value} value={value}>{getRelationshipTypeLabel(value, toolsCopy)}</option>)}
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsStatus}</span>
          <select name="status" value={form.status} onChange={handleChange}>
            {RELATIONSHIP_STATUS_OPTIONS.map(value => <option key={value} value={value}>{getRelationshipStatusLabel(value, toolsCopy)}</option>)}
          </select>
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsStart}</span>
          <input type="date" name="start_date" value={form.start_date} onChange={handleChange} />
        </label>

        <label className="advanced-tools-field">
          <span>{toolsCopy.relationshipsEnd}</span>
          <input type="date" name="end_date" value={form.end_date} onChange={handleChange} />
        </label>

        <label className="advanced-tools-field advanced-tools-field-wide">
          <span>{toolsCopy.relationshipsNotes}</span>
          <textarea name="notes" rows="2" value={form.notes} onChange={handleChange} />
        </label>
      </div>

      <div className="advanced-tools-actions">
        <button type="button" className="btn-primary" onClick={submit}>
          {editingId ? toolsCopy.relationshipsUpdate : toolsCopy.relationshipsAdd}
        </button>
        {editingId ? (
          <button type="button" className="btn-cancel" onClick={resetForm}>{toolsCopy.relationshipsCancel}</button>
        ) : null}
      </div>

      <div className="advanced-tools-list">
        {relationships.length === 0 ? (
          <div className="dashboard-empty">{toolsCopy.relationshipsNone}</div>
        ) : relationships.map(relationship => (
          <div key={relationship.id} className="advanced-list-item">
            <div>
              <strong>{relationship.person1_name}</strong> ↔ <strong>{relationship.person2_name}</strong>
            </div>
            <div>{getRelationshipTypeLabel(relationship.relationship_type, toolsCopy)} · {getRelationshipStatusLabel(relationship.status, toolsCopy)}</div>
            <div>{relationship.start_date || '—'} → {relationship.end_date || '—'}</div>
            <div className="advanced-tools-actions compact">
              <button type="button" className="btn-edit" onClick={() => startEditing(relationship)}>{copy.modalEdit}</button>
              <button type="button" className="btn-delete" onClick={() => remove(relationship.id)}>{toolsCopy.relationshipsDelete}</button>
            </div>
          </div>
        ))}
      </div>
    </ToolCard>
  )
}

export function DuplicatesCard({ onMerged, onError, copy, toolsCopy }) {
  const [pairs, setPairs] = useState([])
  const [threshold, setThreshold] = useState('0.82')
  const [isScanning, setIsScanning] = useState(false)

  const scan = async () => {
    setIsScanning(true)
    try {
      const response = await api.get('/api/people/duplicates/', { params: { threshold: threshold || '0.82' } })
      setPairs(response.data?.pairs || [])
    } catch (error) {
      onError(error)
    } finally {
      setIsScanning(false)
    }
  }

  const merge = async ({ left, right }) => {
    const message = toolsCopy.duplicatesConfirmMerge.replace('{from}', right.name).replace('{to}', left.name)
    if (!window.confirm(message)) return
    try {
      await api.post('/api/people/merge/', { primary_id: left.id, duplicate_ids: [right.id] })
      await onMerged()
      await scan()
    } catch (error) {
      onError(error)
    }
  }

  return (
    <ToolCard title={toolsCopy.duplicatesTitle} toolsCopy={toolsCopy}>
      <div className="advanced-tools-fields">
        <label className="advanced-tools-field">
          <span>{toolsCopy.duplicatesThreshold}</span>
          <input
            type="number"
            min="0.60"
            max="0.98"
            step="0.01"
            value={threshold}
            onChange={event => setThreshold(event.target.value)}
          />
        </label>
        <button type="button" className="btn-primary" onClick={scan} disabled={isScanning}>
          {isScanning ? copy.saving : toolsCopy.duplicatesScan}
        </button>
      </div>

      <div className="advanced-tools-list">
        {pairs.length === 0 ? (
          <div className="dashboard-empty">{toolsCopy.duplicatesNone}</div>
        ) : pairs.map(pair => (
          <div key={`${pair.left.id}-${pair.right.id}`} className="advanced-list-item">
            <div><strong>{pair.left.name}</strong> ⇄ <strong>{pair.right.name}</strong></div>
            <div>{toolsCopy.duplicatesScore}: {pair.score}</div>
            <div>{pair.left.birth_date || '—'} / {pair.right.birth_date || '—'}</div>
            <div className="advanced-tools-actions compact">
              <button type="button" className="btn-primary" onClick={() => merge(pair)}>
                {toolsCopy.duplicatesMerge}
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToolCard>
  )
}
