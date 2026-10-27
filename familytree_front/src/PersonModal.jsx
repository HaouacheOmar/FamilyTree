import { useEffect, useId, useState } from 'react'
import { motion } from 'motion/react'
import { OliveBranch } from './icons'
import { dialog, fade } from './motionPresets'

const EMPTY_PERSON_FORM = {
  first_name: '', last_name: '', gender: 'O', birth_date: '', death_date: '',
  birth_place: '', death_place: '', occupation: '', biography: '',
  mother: '', father: '', adoptive_mother: '', adoptive_father: '',
  spouse: '', husband: '', wife: '', photo: null,
}

// Mounted only while open; App wraps it in <AnimatePresence> so it can animate out.
export default function PersonModal({ onClose, person, people, onSave, onDelete, copy, toolsCopy }) {
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_PERSON_FORM)
  const titleId = useId()

  useEffect(() => {
    if (person) {
      const filled = { ...EMPTY_PERSON_FORM }
      Object.keys(filled).forEach(key => {
        if (key !== 'photo' && person[key] != null) filled[key] = person[key]
      })
      setForm(filled)
      setEditing(false)
    } else {
      setForm(EMPTY_PERSON_FORM)
      setEditing(true)
    }
  }, [person])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleFile = (e) => setForm(prev => ({ ...prev, photo: e.target.files[0] }))

  const handleSubmit = async () => {
    setIsSaving(true)
    const formData = new FormData()
    Object.keys(form).forEach(key => {
      if (key === 'photo') {
        if (form.photo instanceof File) formData.append('photo', form.photo)
      } else {
        formData.append(key, form[key] ?? '')
      }
    })

    try {
      await onSave(formData, person?.id)
      setEditing(false)
      if (!person) onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const others = people.filter(p => p.id !== person?.id)
  const men = others.filter(p => p.gender === 'M')
  const women = others.filter(p => p.gender === 'F')

  const textField = (name, label, props = {}) => (
    <label className={`form-field ${props.wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      {props.multiline
        ? <textarea name={name} value={form[name]} onChange={handleChange} rows={3} />
        : <input name={name} type={props.type || 'text'} value={form[name]} onChange={handleChange} autoFocus={props.autoFocus} />}
    </label>
  )

  const personSelect = (name, label, candidates) => (
    <label className="form-field">
      <span>{label}</span>
      <select name={name} value={form[name]} onChange={handleChange}>
        <option value="">{copy.none}</option>
        {candidates.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
      </select>
    </label>
  )

  const details = person ? [
    [copy.modalBorn, person.birth_date],
    [copy.modalDied, person.death_date],
    [copy.birthPlace, person.birth_place],
    [copy.deathPlace, person.death_place],
    [copy.occupation, person.occupation],
    [copy.father, person.father_name],
    [copy.mother, person.mother_name],
    [toolsCopy.adoptiveMother, person.adoptive_mother_name],
    [toolsCopy.adoptiveFather, person.adoptive_father_name],
    [copy.modalSpouse, person.spouse_name],
    [copy.modalHusband, person.husband_name],
    [toolsCopy.wifeLabel, person.wife_name],
  ].filter(([, value]) => value) : [] // only what is known; a wall of "—" reads as an empty record

  return (
    <motion.div className="modal-overlay" onClick={onClose} {...fade}>
      <motion.div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        {...dialog}
      >
        {!editing && person ? (
          <div className="modal-view">
            <div className="modal-header-flex">
              {person.photo_url && <img src={person.photo_url} className="modal-photo" alt="" />}
              <div>
                <h2 id={titleId} className="modal-title">
                  {person.first_name} {person.last_name}
                  {person.death_date && <OliveBranch size={20} aria-label={toolsCopy.inMemory} aria-hidden="false" role="img" />}
                </h2>
                <p className="modal-subtitle">
                  {person.gender === 'M' ? copy.modalGenderMale : person.gender === 'F' ? copy.modalGenderFemale : copy.modalGenderOther}
                </p>
              </div>
            </div>
            <dl className="modal-details-grid">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {person.biography && (
                <div className="is-wide">
                  <dt>{copy.biography}</dt>
                  <dd>{person.biography}</dd>
                </div>
              )}
            </dl>
            <div className="modal-actions">
              <button type="button" className="btn-edit" onClick={() => setEditing(true)} autoFocus>{copy.modalEdit}</button>
              <button type="button" className="btn-delete" onClick={() => onDelete(person.id)}>{copy.modalDelete}</button>
              <button type="button" className="btn-close" onClick={onClose}>{copy.modalClose}</button>
            </div>
          </div>
        ) : (
          <div className="person-form">
            <h3 id={titleId}>{person ? copy.modalEdit : copy.formTitle}</h3>
            <div className="form-grid">
              {textField('first_name', copy.firstName, { autoFocus: true })}
              {textField('last_name', copy.lastName)}
              <label className="form-field">
                <span>{copy.gender}</span>
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option value="M">{copy.male}</option>
                  <option value="F">{copy.female}</option>
                  <option value="O">{copy.other}</option>
                </select>
              </label>
              {textField('occupation', copy.occupation)}
              {textField('birth_date', copy.birthDate, { type: 'date' })}
              {textField('death_date', copy.deathDate, { type: 'date' })}
              {textField('birth_place', copy.birthPlace)}
              {textField('death_place', copy.deathPlace)}
              {textField('biography', copy.biography, { multiline: true, wide: true })}
              {personSelect('father', copy.father, men)}
              {personSelect('mother', copy.mother, women)}
              {personSelect('adoptive_father', toolsCopy.adoptiveFather, men)}
              {personSelect('adoptive_mother', toolsCopy.adoptiveMother, women)}
              {personSelect('spouse', copy.modalSpouse, others)}
              {personSelect('husband', copy.modalHusband, others)}
              {personSelect('wife', toolsCopy.wifeLabel, others)}
              <label className="form-field is-wide">
                <span>{copy.photo}</span>
                <input type="file" onChange={handleFile} accept="image/*" />
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={() => (person ? setEditing(false) : onClose())}>{copy.cancel}</button>
              <button type="button" className="btn-save" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? copy.saving : copy.save}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
