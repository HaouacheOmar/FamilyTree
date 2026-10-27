import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import FamilyTree from './Tree'
import PersonModal from './PersonModal'
import TreeControls from './TreeControls'
import Dashboard from './Dashboard'
import { BirthdayReminderPanel } from './BirthdayPanels'
import { DEFAULT_FILTERS, DEFAULT_RESULT_LIMIT, DuplicatesCard, FiltersCard, RelationshipEditor } from './AdvancedTools'
import { api, describeError } from './api'
import { upcomingBirthdays } from './birthdays.mjs'
import { getCopy, LANGUAGE_OPTIONS } from './i18n'
import { useCloseOnOutsideClick, useTreePreferences } from './hooks'
import { AlertCircle, Check, ChevronDown, X } from './icons'
import { popover, toast as toastMotion } from './motionPresets'
import appLogo from './assets/app-logo.svg'
import exportIcon from './assets/export-svgrepo-com.svg'
import importIcon from './assets/import-svgrepo-com.svg'
import '../style/App.css'

// Electron starts the backend together with this window, so the first fetch keeps retrying for a while.
const INITIAL_BACKEND_RETRIES = 20
const INITIAL_BACKEND_RETRY_DELAY_MS = 1000

const TOAST_DURATION_MS = 4500

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

export default function App() {
  const [language, setLanguage] = useState('ar')
  const [people, setPeople] = useState([])
  const [totalPeople, setTotalPeople] = useState(0)
  const [directoryPeople, setDirectoryPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [slowStart, setSlowStart] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  // Bumped after every data change so panels refetch; stays 0 until the backend first answers.
  const [dataVersion, setDataVersion] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [smartSearch, setSmartSearch] = useState(true)
  const [resultLimit, setResultLimit] = useState(DEFAULT_RESULT_LIMIT)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [preferences, setPreference, resetPreferences] = useTreePreferences()
  const languageMenuRef = useRef(null)
  const backupInputRef = useRef(null)
  const gedcomInputRef = useRef(null)
  const latestPeopleRequest = useRef(0)
  const [toasts, setToasts] = useState([])
  useCloseOnOutsideClick(languageMenuRef, setIsLanguageMenuOpen)

  const { copy, toolsCopy, renderModeCopy, labelDensityCopy, birthdayCopy, birthdayPanelCopy } = getCopy(language)
  const selectedLanguageOption = LANGUAGE_OPTIONS.find(option => option.code === language)
  const todayPeople = useMemo(() => upcomingBirthdays(people, 0).map(entry => entry.person), [people])
  const birthdayPersonIds = useMemo(() => new Set(todayPeople.map(person => String(person.id))), [todayPeople])

  const openPerson = useCallback((person) => {
    setSelectedPerson(person)
    setModalOpen(true)
  }, [])

  const dismissToast = useCallback(id => setToasts(prev => prev.filter(item => item.id !== id)), [])
  const showToast = useCallback((kind, message) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, kind, message }])
    // Errors stay until dismissed; successes clear themselves.
    if (kind === 'success') setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
  }, [dismissToast])

  const alertRequestFailed = (error) => showToast('error', `${copy.requestFailed}: ${describeError(error)}`)
  const closeModal = useCallback(() => setModalOpen(false), [])

  const fetchPeople = async ({ retries = 1, retryDelayMs = 0 } = {}) => {
    const requestId = ++latestPeopleRequest.current
    const params = { smart: smartSearch ? '1' : '0', limit: String(resultLimit || DEFAULT_RESULT_LIMIT) }
    if (searchQuery.trim()) params.q = searchQuery.trim()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== 'all') params[key] = value
    })

    let lastError = null
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const res = await api.get('/api/people/', { timeout: 6000, params })
        // A slower, older search must not overwrite the results of a newer one.
        if (requestId === latestPeopleRequest.current) {
          setPeople(res.data)
          setTotalPeople(Number(res.headers['x-total-count']) || res.data.length)
        }
        return true
      } catch (error) {
        lastError = error
        // 403 = missing or wrong access token (hosted install); retrying won't help.
        if (error.response?.status === 403) {
          setAccessDenied(true)
          break
        }
        if (attempt < retries) await wait(retryDelayMs)
      }
    }
    console.error('Error fetching people:', lastError)
    return false
  }

  // Everyone, unfiltered: feeds the person pickers in the modal and the tools.
  const fetchDirectoryPeople = async () => {
    try {
      const res = await api.get('/api/people/', { timeout: 6000, params: { smart: '0' } })
      setDirectoryPeople(res.data || [])
    } catch (error) {
      console.error(error)
    }
  }

  const refreshAllData = async () => {
    await Promise.all([fetchPeople({ retries: 3, retryDelayMs: 500 }), fetchDirectoryPeople()])
    setDataVersion(version => version + 1)
  }

  useEffect(() => {
    const loadInitialData = async () => {
      const ok = await fetchPeople({ retries: INITIAL_BACKEND_RETRIES, retryDelayMs: INITIAL_BACKEND_RETRY_DELAY_MS })
      if (ok) {
        await fetchDirectoryPeople()
        setDataVersion(1)
      } else {
        console.error('Backend did not become available in time.')
      }
      setLoading(false)
    }
    loadInitialData()
  }, [])

  // A hosted backend on a free tier sleeps when idle; explain the wait instead of a bare "Loading...".
  useEffect(() => {
    if (!loading) return
    const timeoutId = setTimeout(() => setSlowStart(true), 5000)
    return () => clearTimeout(timeoutId)
  }, [loading])

  useEffect(() => {
    if (loading) return
    const timeoutId = setTimeout(() => fetchPeople({ retries: 2, retryDelayMs: 250 }), 260)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, smartSearch, resultLimit, filters, loading])

  const downloadFile = async (path, filename) => {
    try {
      const response = await api.get(path, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      alertRequestFailed(error)
    }
  }

  const uploadFile = async (event, path, field, { confirmMessage, successMessage } = {}) => {
    const file = event.target.files[0]
    event.target.value = '' // allow picking the same file again
    if (!file || (confirmMessage && !window.confirm(confirmMessage))) return

    const formData = new FormData()
    formData.append(field, file)
    try {
      await api.post(path, formData)
      if (successMessage) showToast('success', successMessage)
      await refreshAllData()
    } catch (error) {
      alertRequestFailed(error)
    }
  }

  const handleSave = async (formData, id) => {
    try {
      const response = id ? await api.patch(`/api/people/${id}/`, formData) : await api.post('/api/people/', formData)
      if (id) setSelectedPerson(response.data) // the modal shows the saved values, not the pre-edit object
      await refreshAllData()
    } catch (error) {
      alertRequestFailed(error)
      throw error
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(copy.deleteConfirm)) return
    try {
      await api.delete(`/api/people/${id}/`)
      setModalOpen(false)
      await refreshAllData()
    } catch (error) {
      alertRequestFailed(error)
    }
  }

  const direction = language === 'ar' ? 'rtl' : 'ltr'

  return (
    <MotionConfig reducedMotion="user">
    <div className={`app-container ${direction}`} dir={direction} lang={language}>
      <header className="app-header">
        <div className="header-left">
          <img src={appLogo} alt="Logo" className="logo" />
          <div className="brand-copy">
            <h1>{copy.appTitle}</h1>
            <p>{copy.appSubtitle}</p>
          </div>
        </div>

        <div className="search-bar header-search">
          <input
            type="text"
            className="search-input"
            placeholder={copy.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="header-actions">
          <div className="dropdown-menu language-dropdown" ref={languageMenuRef}>
            <button type="button" className="dropdown-trigger language-trigger" onClick={() => setIsLanguageMenuOpen(prev => !prev)}>
              <img src={selectedLanguageOption.flag} alt="" className="language-flag-icon" />
              <span>{selectedLanguageOption.label}</span>
              <span className="dropdown-caret"><ChevronDown size={14} /></span>
            </button>
            <AnimatePresence>
            {isLanguageMenuOpen && (
              <motion.div className="dropdown-panel language-panel" role="listbox" aria-label={selectedLanguageOption.label} {...popover}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    role="option"
                    aria-selected={language === option.code}
                    className={`dropdown-option ${language === option.code ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(option.code)
                      setIsLanguageMenuOpen(false)
                    }}
                  >
                    <img src={option.flag} alt="" className="language-flag-icon" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
          <button className="btn-lang header-action-btn" onClick={() => downloadFile('/api/export/', 'family_tree_backup.zip')}>
            <img src={exportIcon} alt="" className="header-action-icon" />
            {copy.exportTree}
          </button>
          <button className="btn-lang header-action-btn" onClick={() => backupInputRef.current.click()}>
            <img src={importIcon} alt="" className="header-action-icon" />
            {copy.importTree}
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={(e) => uploadFile(e, '/api/import/', 'backup', { confirmMessage: copy.importConfirm, successMessage: toolsCopy.importSuccess })}
          />
          <button className="btn-lang header-action-btn" onClick={() => downloadFile('/api/export-gedcom/', 'family_tree.ged')}>
            <img src={exportIcon} alt="" className="header-action-icon" />
            {copy.exportGedcom}
          </button>
          <button className="btn-lang header-action-btn" onClick={() => gedcomInputRef.current.click()}>
            <img src={importIcon} alt="" className="header-action-icon" />
            {copy.importGedcom}
          </button>
          <input
            ref={gedcomInputRef}
            type="file"
            accept=".ged,.txt"
            style={{ display: 'none' }}
            onChange={(e) => uploadFile(e, '/api/import-gedcom/', 'gedcom')}
          />
          <button className="btn-primary add-member-btn" onClick={() => openPerson(null)}>
            <svg className="add-member-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 19c0-2.761-2.239-5-5-5s-5 2.239-5 5" />
              <circle cx="10" cy="8" r="3" />
              <path d="M18 8v6" />
              <path d="M15 11h6" />
            </svg>
            <span>{copy.addPerson}</span>
          </button>
        </div>
      </header>

      <main className="app-main">
        <BirthdayReminderPanel people={people} todayPeople={todayPeople} onOpenPerson={openPerson} birthdayPanelCopy={birthdayPanelCopy} />

        <TreeControls
          preferences={preferences}
          setPreference={setPreference}
          resetPreferences={resetPreferences}
          copy={copy}
          renderModeCopy={renderModeCopy}
          labelDensityCopy={labelDensityCopy}
        />

        {accessDenied && <p className="tree-truncated-notice" role="alert">{toolsCopy.accessDenied}</p>}

        {loading ? <p>{slowStart ? toolsCopy.wakingServer : copy.loadingPeople}</p> : (
          <>
            {people.length < totalPeople && (
              <p className="tree-truncated-notice">
                {toolsCopy.treeTruncated.replace('{shown}', people.length).replace('{total}', totalPeople)}
              </p>
            )}

            <FamilyTree
              people={people}
              language={language}
              backgroundColor={preferences.backgroundColor}
              nodeShape={preferences.nodeShape}
              treeOrientation={preferences.treeOrientation}
              treeRenderMode={preferences.treeRenderMode}
              threeLabelDensity={preferences.threeLabelDensity}
              birthdayPersonIds={birthdayPersonIds}
              onSelect={openPerson}
            />
          </>
        )}

        <h2 className="tools-section-title">{toolsCopy.toolsSectionTitle}</h2>
        <section className="advanced-tools-grid">
          <FiltersCard
            filters={filters}
            setFilters={setFilters}
            smartSearch={smartSearch}
            setSmartSearch={setSmartSearch}
            resultLimit={resultLimit}
            setResultLimit={setResultLimit}
            directoryPeople={directoryPeople}
            copy={copy}
            toolsCopy={toolsCopy}
          />
          <RelationshipEditor
            directoryPeople={directoryPeople}
            dataVersion={dataVersion}
            onChanged={refreshAllData}
            onError={alertRequestFailed}
            copy={copy}
            toolsCopy={toolsCopy}
          />
          <DuplicatesCard onMerged={refreshAllData} onError={alertRequestFailed} copy={copy} toolsCopy={toolsCopy} />
        </section>

        <Dashboard
          todayPeople={todayPeople}
          dataVersion={dataVersion}
          onOpenPerson={openPerson}
          copy={copy}
          toolsCopy={toolsCopy}
          birthdayCopy={birthdayCopy}
        />
      </main>

      <AnimatePresence>
        {modalOpen && (
          <PersonModal
            key="person-modal"
            onClose={closeModal}
            person={selectedPerson}
            people={directoryPeople}
            onSave={handleSave}
            onDelete={handleDelete}
            copy={copy}
            toolsCopy={toolsCopy}
          />
        )}
      </AnimatePresence>

      <div className="toast-stack" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map(item => (
            <motion.div key={item.id} layout className={`toast is-${item.kind}`} {...toastMotion(direction)}>
              {item.kind === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
              <span className="toast-message">{item.message}</span>
              <button type="button" className="toast-close" onClick={() => dismissToast(item.id)} aria-label={toolsCopy.dismissNotification}>
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
    </MotionConfig>
  )
}
