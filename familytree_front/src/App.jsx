import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import FamilyTree from './Tree'
import appLogo from './assets/app-logo.svg'
import exportIcon from './assets/export-svgrepo-com.svg'
import importIcon from './assets/import-svgrepo-com.svg'
import flagAlgeria from './assets/flag-for-algeria-svgrepo-com.svg'
import flagFrance from './assets/flag-for-flag-france-svgrepo-com.svg'
import flagUk from './assets/uk-flag-svgrepo-com.svg'
import '../style/App.css'

const API_BASE_URL = 'http://127.0.0.1:8000'
const INITIAL_BACKEND_RETRIES = 20
const INITIAL_BACKEND_RETRY_DELAY_MS = 1000

const SEARCH_ALIASES = {
  aunts: 'aunt', brothers: 'brother', children: 'child', cousins: 'cousin',
  dad: 'father', daughters: 'daughter', familyname: 'last_name',
  grandfather: 'grandpa', grandma: 'grandma', grandmother: 'grandma',
  grandpa: 'grandpa', granddad: 'grandpa', husbands: 'husband',
  lastname: 'last_name', mom: 'mother', mum: 'mother', nephews: 'nephew',
  nieces: 'niece', partners: 'partner', siblings: 'sibling', sisters: 'sister',
  sons: 'son', spouses: 'spouse', surname: 'last_name', uncles: 'uncle',
  wives: 'wife', 'أم': 'mother', 'ام': 'mother', 'أمهات': 'mother',
  'أب': 'father', 'اب': 'father', 'آباء': 'father', 'ابن': 'son',
  'ابنة': 'daughter', 'أبناء': 'child', 'بنات': 'daughter', 'أخ': 'brother',
  'اخ': 'brother', 'أخت': 'sister', 'اخت': 'sister', 'إخوة': 'sibling',
  'اخوة': 'sibling', 'أخوات': 'sister', 'زوج': 'husband', 'زوجة': 'wife',
  'أزواج': 'spouse', 'شريك': 'partner', 'شريكة': 'partner', 'جد': 'grandpa',
  'جدة': 'grandma', 'أجداد': 'grandparent', 'حفيد': 'grandchild',
  'حفيدة': 'grandchild', 'أحفاد': 'grandchild', 'عمة': 'aunt',
  'عمات': 'aunt', 'خالة': 'aunt', 'خالات': 'aunt', 'عم': 'uncle',
  'أعمام': 'uncle', 'خال': 'uncle', 'أخوال': 'uncle', 'ابن_عم': 'cousin',
  'ابن_خال': 'cousin', 'قريب': 'relative', 'أقارب': 'relative',
  'لقب': 'last_name', 'العائلة': 'last_name',
}

const SEARCH_STOP_WORDS = new Set([
  'all', 'and', 'by', 'family', 'name', 'relation', 'relationships', 'و', 'كل', 'حسب', 'العائلة', 'اسم', 'الاسم', 'العلاقات', 'علاقة',
])

const UI_COPY = {
  ar: {
    appTitle: 'شجرة العائلة', appSubtitle: 'استكشف الروابط العائلية، أضف أفرادا جددا، ونظم تاريخ العائلة بسهولة.', switchLanguage: 'English', addPerson: 'إضافة فرد', exportTree: 'تصدير الشجرة', importTree: 'استيراد الشجرة', importConfirm: 'تحذير: سيؤدي الاستيراد إلى استبدال شجرة العائلة الحالية. هل تريد المتابعة؟', exportGedcom: 'تصدير GEDCOM', importGedcom: 'استيراد GEDCOM', statsTitle: 'إحصاءات العائلة', totalPeople: 'إجمالي الأفراد', livingPeople: 'الأحياء', deceasedPeople: 'المتوفون', averageAge: 'متوسط العمر', oldestAge: 'أكبر عمر', timelineTitle: 'الخط الزمني', birthPlace: 'مكان الميلاد', deathPlace: 'مكان الوفاة', occupation: 'المهنة', biography: 'نبذة', timelineEmpty: 'لا توجد أحداث حتى الآن', searchPlaceholder: 'ابحث حسب صلة القرابة (عمة، جد، زوج) أو اسم العائلة', formTitle: 'إضافة فرد', firstName: 'الاسم الأول', lastName: 'اسم العائلة', gender: 'الجنس', male: 'ذكر', female: 'أنثى', other: 'آخر', birthDate: 'تاريخ الميلاد', deathDate: 'تاريخ الوفاة', mother: 'الأم', father: 'الأب', modalSpouse: 'الزوجة / الشريكة', modalHusband: 'الزوج', photo: 'الصورة', none: '— لا يوجد —', save: 'حفظ', saving: 'جار الحفظ...', cancel: 'إلغاء', loadingPeople: 'جار تحميل الأفراد...', requestFailed: 'فشل الطلب', deleteConfirm: 'هل تريد حذف هذا الفرد؟', modalGenderMale: 'ذكر', modalGenderFemale: 'أنثى', modalGenderOther: 'آخر', modalBorn: 'تاريخ الميلاد', modalDied: 'تاريخ الوفاة', modalEdit: 'تعديل', modalDelete: 'حذف', modalClose: 'إغلاق', backgroundPalette: 'لوحة ألوان الخلفية', customColor: 'لون مخصص', shapePalette: 'لوحة الأشكال', orientationPalette: 'اتجاه الشجرة', orientationVertical: 'عمودي', orientationHorizontal: 'أفقي', shapeCircle: 'دائرة', shapeSquare: 'مربع', shapeRounded: 'مربع دائري', shapeDiamond: 'معين', shapeHexagon: 'سداسي', shapeCapsule: 'كبسولة', resetTheme: 'إعادة الضبط', paletteToggleOpen: 'إظهار خيارات الشجرة', paletteToggleClose: 'إخفاء خيارات الشجرة',
  },
  en: {
    appTitle: 'Family Tree', appSubtitle: 'Explore family connections, add members, and keep your family history organized.', switchLanguage: 'Français', addPerson: 'Add Person', exportTree: 'Export Tree', importTree: 'Import Tree', importConfirm: 'Warning: Importing will replace your current family tree. Continue?', exportGedcom: 'Export GEDCOM', importGedcom: 'Import GEDCOM', statsTitle: 'Family Stats', totalPeople: 'Total People', livingPeople: 'Living People', deceasedPeople: 'Deceased People', averageAge: 'Average Age', oldestAge: 'Oldest Age', timelineTitle: 'Timeline', birthPlace: 'Birth Place', deathPlace: 'Death Place', occupation: 'Occupation', biography: 'Biography', timelineEmpty: 'No events yet', searchPlaceholder: 'Search by relation (aunt, grandpa, spouse) or family name', formTitle: 'Add Person', firstName: 'First name', lastName: 'Last name', gender: 'Gender', male: 'Male', female: 'Female', other: 'Other', birthDate: 'Birth date', deathDate: 'Date of Death', mother: 'Mother', father: 'Father', modalSpouse: 'Wife / Partner', modalHusband: 'Husband', photo: 'Photo', none: '— none —', save: 'Save', saving: 'Saving...', cancel: 'Cancel', loadingPeople: 'Loading people...', requestFailed: 'Request failed', deleteConfirm: 'Delete this person?', modalGenderMale: 'Male', modalGenderFemale: 'Female', modalGenderOther: 'Other', modalBorn: 'Born', modalDied: 'Died', modalEdit: 'Edit', modalDelete: 'Delete', modalClose: 'Close', backgroundPalette: 'Background Palette', customColor: 'Custom Color', shapePalette: 'Shape Palette', orientationPalette: 'Tree Orientation', orientationVertical: 'Vertical', orientationHorizontal: 'Horizontal', shapeCircle: 'Circle', shapeSquare: 'Square', shapeRounded: 'Rounded', shapeDiamond: 'Diamond', shapeHexagon: 'Hexagon', shapeCapsule: 'Capsule', resetTheme: 'Reset Theme', paletteToggleOpen: 'Show tree controls', paletteToggleClose: 'Hide tree controls',
  },
  fr: {
    appTitle: 'Arbre Généalogique', appSubtitle: 'Explorez les liens familiaux, ajoutez des membres et organisez votre histoire familiale.', switchLanguage: 'العربية', addPerson: 'Ajouter', exportTree: 'Exporter l\'arbre', importTree: 'Importer l\'arbre', importConfirm: 'Attention : L\'importation remplacera votre arbre généalogique actuel. Continuer ?', exportGedcom: 'Exporter GEDCOM', importGedcom: 'Importer GEDCOM', statsTitle: 'Statistiques', totalPeople: 'Nombre total', livingPeople: 'Personnes vivantes', deceasedPeople: 'Personnes décédées', averageAge: 'Âge moyen', oldestAge: 'Âge maximal', timelineTitle: 'Chronologie', birthPlace: 'Lieu de naissance', deathPlace: 'Lieu de décès', occupation: 'Profession', biography: 'Biographie', timelineEmpty: 'Aucun événement pour le moment', searchPlaceholder: 'Rechercher par relation (tante, grand-père) ou nom de famille', formTitle: 'Ajouter une personne', firstName: 'Prénom', lastName: 'Nom de famille', gender: 'Genre', male: 'Homme', female: 'Femme', other: 'Autre', birthDate: 'Date de naissance', deathDate: 'Date de décès', mother: 'Mère', father: 'Père', modalSpouse: 'Épouse / Partenaire', modalHusband: 'Mari', photo: 'Photo', none: '— aucun —', save: 'Enregistrer', saving: 'Enregistrement...', cancel: 'Annuler', loadingPeople: 'Chargement...', requestFailed: 'Échec de la requête', deleteConfirm: 'Supprimer cette personne ?', modalGenderMale: 'Homme', modalGenderFemale: 'Femme', modalGenderOther: 'Autre', modalBorn: 'Né(e)', modalDied: 'Décédé(e)', modalEdit: 'Modifier', modalDelete: 'Supprimer', modalClose: 'Fermer', backgroundPalette: 'Couleur de fond', customColor: 'Couleur personnalisée', shapePalette: 'Forme des nœuds', orientationPalette: 'Orientation de l\'arbre', orientationVertical: 'Verticale', orientationHorizontal: 'Horizontale', shapeCircle: 'Cercle', shapeSquare: 'Carré', shapeRounded: 'Arrondi', shapeDiamond: 'Losange', shapeHexagon: 'Hexagone', shapeCapsule: 'Capsule', resetTheme: 'Réinitialiser', paletteToggleOpen: 'Afficher les options', paletteToggleClose: 'Masquer les options',
  },
}

const BACKGROUND_SWATCHES = ['#fdfbf7', '#f1f5f9', '#eef8ff', '#fff8eb', '#f5efe6', '#eef6ec']
const SHAPE_OPTIONS = ['circle', 'square', 'rounded', 'diamond', 'hexagon', 'capsule']
const ORIENTATION_OPTIONS = ['vertical', 'horizontal']
const RENDER_MODE_OPTIONS = ['2d', '3d']
const LABEL_DENSITY_OPTIONS = ['all', 'hide-deep', 'names-only']
const BG_STORAGE_KEY = 'familytree_background_color'
const SHAPE_STORAGE_KEY = 'familytree_node_shape'
const ORIENTATION_STORAGE_KEY = 'familytree_tree_orientation'
const RENDER_MODE_STORAGE_KEY = 'familytree_render_mode'
const LABEL_DENSITY_STORAGE_KEY = 'familytree_3d_label_density'
const BIRTHDAY_WINDOW_OPTIONS = [7, 30]
const BIRTHDAY_REMINDER_STORAGE_KEY = 'familytree_birthday_reminder_dismissed'
const LANGUAGE_OPTIONS = [
  { code: 'ar', label: 'العربية', flag: flagAlgeria },
  { code: 'en', label: 'English', flag: flagUk },
  { code: 'fr', label: 'Français', flag: flagFrance },
]

const RELATIONSHIP_TYPE_OPTIONS = ['MARRIAGE', 'PARTNER']
const RELATIONSHIP_STATUS_OPTIONS = ['ACTIVE', 'DIVORCED', 'SEPARATED', 'WIDOWED', 'ENDED']

const TOOLS_COPY = {
  ar: {
    filtersTitle: 'بحث متقدم',
    filtersSmart: 'بحث ذكي',
    filtersLimit: 'حد النتائج',
    filtersLiving: 'الحالة',
    filtersAll: 'الكل',
    filtersLivingOnly: 'الأحياء',
    filtersDeceasedOnly: 'المتوفون',
    filtersLocation: 'المكان (ميلاد/وفاة)',
    filtersBirthFrom: 'ميلاد من',
    filtersBirthTo: 'ميلاد إلى',
    filtersDeathFrom: 'وفاة من',
    filtersDeathTo: 'وفاة إلى',
    filtersBranch: 'فرع العائلة',
    filtersBranchDepth: 'عمق الفرع',
    filtersReset: 'إعادة تعيين الفلاتر',
    relationshipsTitle: 'إدارة العلاقات',
    relationshipsFilterPerson: 'تصفية حسب الشخص',
    relationshipsAdd: 'إضافة علاقة',
    relationshipsUpdate: 'تحديث العلاقة',
    relationshipsCancel: 'إلغاء التعديل',
    relationshipsDelete: 'حذف',
    relationshipsDeleteConfirm: 'هل تريد حذف سجل العلاقة هذا؟',
    relationshipsSelectTwoPeople: 'يرجى اختيار شخصين للعلاقة.',
    relationshipsNone: 'لا توجد علاقات مطابقة',
    relationshipsPerson1: 'الشخص 1',
    relationshipsPerson2: 'الشخص 2',
    relationshipsType: 'نوع العلاقة',
    relationshipsStatus: 'الحالة',
    relationshipsNotes: 'ملاحظات',
    adoptiveMother: 'الأم بالتبني',
    adoptiveFather: 'الأب بالتبني',
    wifeLabel: 'الزوجة',
    relationshipTypes: {
      MARRIAGE: 'زواج',
      PARTNER: 'شراكة',
    },
    relationshipStatuses: {
      ACTIVE: 'نشط',
      DIVORCED: 'مطلق',
      SEPARATED: 'منفصل',
      WIDOWED: 'أرمل',
      ENDED: 'منتهية',
    },
    duplicatesTitle: 'أدوات جودة البيانات',
    duplicatesScan: 'فحص التكرار',
    duplicatesThreshold: 'عتبة التشابه',
    duplicatesMerge: 'دمج هذا الزوج',
    duplicatesConfirmMerge: 'دمج {from} في {to}؟',
    duplicatesNone: 'لا توجد عناصر متكررة بالعتبة الحالية',
    panelShow: 'إظهار',
    panelHide: 'إخفاء',
  },
  en: {
    filtersTitle: 'Advanced Filters',
    filtersSmart: 'Smart search',
    filtersLimit: 'Result limit',
    filtersLiving: 'Living status',
    filtersAll: 'All',
    filtersLivingOnly: 'Living',
    filtersDeceasedOnly: 'Deceased',
    filtersLocation: 'Location (birth/death)',
    filtersBirthFrom: 'Birth from',
    filtersBirthTo: 'Birth to',
    filtersDeathFrom: 'Death from',
    filtersDeathTo: 'Death to',
    filtersBranch: 'Family branch',
    filtersBranchDepth: 'Branch depth',
    filtersReset: 'Reset filters',
    relationshipsTitle: 'Relationship Editor',
    relationshipsFilterPerson: 'Filter by person',
    relationshipsAdd: 'Add relationship',
    relationshipsUpdate: 'Update relationship',
    relationshipsCancel: 'Cancel edit',
    relationshipsDelete: 'Delete',
    relationshipsDeleteConfirm: 'Delete this relationship record?',
    relationshipsSelectTwoPeople: 'Please select two people for the relationship.',
    relationshipsNone: 'No matching relationships',
    relationshipsPerson1: 'Person 1',
    relationshipsPerson2: 'Person 2',
    relationshipsType: 'Type',
    relationshipsStatus: 'Status',
    relationshipsNotes: 'Notes',
    adoptiveMother: 'Adoptive Mother',
    adoptiveFather: 'Adoptive Father',
    wifeLabel: 'Wife',
    relationshipTypes: {
      MARRIAGE: 'Marriage',
      PARTNER: 'Partner',
    },
    relationshipStatuses: {
      ACTIVE: 'Active',
      DIVORCED: 'Divorced',
      SEPARATED: 'Separated',
      WIDOWED: 'Widowed',
      ENDED: 'Ended',
    },
    duplicatesTitle: 'Data Quality Tools',
    duplicatesScan: 'Scan duplicates',
    duplicatesThreshold: 'Similarity threshold',
    duplicatesMerge: 'Merge this pair',
    duplicatesConfirmMerge: 'Merge {from} into {to}?',
    duplicatesNone: 'No duplicates found for the current threshold',
    panelShow: 'Show',
    panelHide: 'Hide',
  },
  fr: {
    filtersTitle: 'Filtres avances',
    filtersSmart: 'Recherche intelligente',
    filtersLimit: 'Limite de resultats',
    filtersLiving: 'Statut',
    filtersAll: 'Tous',
    filtersLivingOnly: 'Vivants',
    filtersDeceasedOnly: 'Decedes',
    filtersLocation: 'Lieu (naissance/deces)',
    filtersBirthFrom: 'Naissance de',
    filtersBirthTo: 'Naissance a',
    filtersDeathFrom: 'Deces de',
    filtersDeathTo: 'Deces a',
    filtersBranch: 'Branche familiale',
    filtersBranchDepth: 'Profondeur de branche',
    filtersReset: 'Reinitialiser les filtres',
    relationshipsTitle: 'Editeur de relations',
    relationshipsFilterPerson: 'Filtrer par personne',
    relationshipsAdd: 'Ajouter une relation',
    relationshipsUpdate: 'Mettre a jour',
    relationshipsCancel: 'Annuler',
    relationshipsDelete: 'Supprimer',
    relationshipsDeleteConfirm: 'Supprimer cet enregistrement de relation ?',
    relationshipsSelectTwoPeople: 'Veuillez selectionner deux personnes pour la relation.',
    relationshipsNone: 'Aucune relation correspondante',
    relationshipsPerson1: 'Personne 1',
    relationshipsPerson2: 'Personne 2',
    relationshipsType: 'Type',
    relationshipsStatus: 'Statut',
    relationshipsNotes: 'Notes',
    adoptiveMother: 'Mere adoptive',
    adoptiveFather: 'Pere adoptif',
    wifeLabel: 'Epouse',
    relationshipTypes: {
      MARRIAGE: 'Mariage',
      PARTNER: 'Partenaire',
    },
    relationshipStatuses: {
      ACTIVE: 'Actif',
      DIVORCED: 'Divorce',
      SEPARATED: 'Separe',
      WIDOWED: 'Veuf/Veuve',
      ENDED: 'Termine',
    },
    duplicatesTitle: 'Qualite des donnees',
    duplicatesScan: 'Detecter les doublons',
    duplicatesThreshold: 'Seuil de similarite',
    duplicatesMerge: 'Fusionner cette paire',
    duplicatesConfirmMerge: 'Fusionner {from} dans {to} ?',
    duplicatesNone: 'Aucun doublon avec ce seuil',
    panelShow: 'Afficher',
    panelHide: 'Masquer',
  },
}

function getRelationshipTypeLabel(value, toolsCopy) {
  return toolsCopy.relationshipTypes?.[value] || value
}

function getRelationshipStatusLabel(value, toolsCopy) {
  return toolsCopy.relationshipStatuses?.[value] || value
}

const RENDER_MODE_COPY = {
  ar: {
    title: 'وضع العرض',
    mode2d: 'ثنائي الأبعاد',
    mode3d: 'ثلاثي الأبعاد',
  },
  en: {
    title: 'Render Mode',
    mode2d: '2D',
    mode3d: '3D',
  },
  fr: {
    title: 'Mode de rendu',
    mode2d: '2D',
    mode3d: '3D',
  },
}

const LABEL_DENSITY_COPY = {
  ar: {
    title: 'كثافة تسميات 3D',
    all: 'كل التسميات',
    hideDeep: 'إخفاء الأجيال البعيدة',
    namesOnly: 'الأسماء فقط',
  },
  en: {
    title: '3D Label Density',
    all: 'All labels',
    hideDeep: 'Hide deep generations',
    namesOnly: 'Names only',
  },
  fr: {
    title: 'Densite des etiquettes 3D',
    all: 'Toutes les etiquettes',
    hideDeep: 'Masquer les generations profondes',
    namesOnly: 'Noms uniquement',
  },
}

function getStoredValue(storageKey, fallbackValue, allowedValues) {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored && allowedValues.includes(stored)) {
      return stored
    }
  } catch (error) {
    console.error(error)
  }
  return fallbackValue
}

function getShapeLabel(shape, copy) {
  if (shape === 'circle') return copy.shapeCircle
  if (shape === 'square') return copy.shapeSquare
  if (shape === 'rounded') return copy.shapeRounded
  if (shape === 'diamond') return copy.shapeDiamond
  if (shape === 'hexagon') return copy.shapeHexagon
  if (shape === 'capsule') return copy.shapeCapsule
  return shape
}

function getShapeIconClass(shape) {
  if (shape === 'circle') return 'shape-icon shape-circle'
  if (shape === 'square') return 'shape-icon shape-square'
  if (shape === 'rounded') return 'shape-icon shape-rounded'
  if (shape === 'diamond') return 'shape-icon shape-diamond'
  if (shape === 'hexagon') return 'shape-icon shape-hexagon'
  if (shape === 'capsule') return 'shape-icon shape-capsule'
  return 'shape-icon shape-circle'
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getMonthDay(value) {
  if (!value || typeof value !== 'string' || value.length < 10) return null
  return value.slice(5, 10)
}

function isBirthdayToday(person) {
  if (!person?.birth_date || person.death_date) return false
  const monthDay = getMonthDay(person.birth_date)
  if (!monthDay) return false
  const today = new Date()
  const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return monthDay === todayMonthDay
}

function getBirthdayAge(person) {
  if (!person?.birth_date || person.birth_date.length < 4) return null
  const birthYear = Number.parseInt(person.birth_date.slice(0, 4), 10)
  if (!Number.isFinite(birthYear)) return null
  return new Date().getFullYear() - birthYear
}

function getDaysUntilBirthday(person, fromDate = new Date()) {
  if (!person?.birth_date || person.birth_date.length < 10 || person.death_date) return null

  const birthMonth = Number.parseInt(person.birth_date.slice(5, 7), 10)
  const birthDay = Number.parseInt(person.birth_date.slice(8, 10), 10)
  if (!Number.isFinite(birthMonth) || !Number.isFinite(birthDay)) return null

  const year = fromDate.getFullYear()
  const candidateThisYear = new Date(year, birthMonth - 1, birthDay)
  const isValidCandidate = candidateThisYear.getMonth() === birthMonth - 1 && candidateThisYear.getDate() === birthDay
  const candidate = isValidCandidate && candidateThisYear >= new Date(year, fromDate.getMonth(), fromDate.getDate())
    ? candidateThisYear
    : new Date(year + 1, birthMonth - 1, birthDay)

  const startOfToday = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
  return Math.round((candidate - startOfToday) / (1000 * 60 * 60 * 24))
}

function Modal({ open, onClose, person, people, onSave, onDelete, copy, toolsCopy }) {
  const [editing, setEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: '', last_name: '', gender: 'O', birth_date: '', death_date: '',
    birth_place: '', death_place: '', occupation: '', biography: '',
    mother: '', father: '', adoptive_mother: '', adoptive_father: '',
    spouse: '', husband: '', wife: '', photo: null,
  })

  useEffect(() => {
    if (person) {
      setForm({
        first_name: person.first_name || '', last_name: person.last_name || '',
        gender: person.gender || 'O', birth_date: person.birth_date || '', death_date: person.death_date || '',
        birth_place: person.birth_place || '', death_place: person.death_place || '',
        occupation: person.occupation || '', biography: person.biography || '',
        mother: person.mother || '', father: person.father || '',
        adoptive_mother: person.adoptive_mother || '', adoptive_father: person.adoptive_father || '',
        spouse: person.spouse || '', husband: person.husband || '', wife: person.wife || '', photo: null
      })
      setEditing(false)
    } else {
      setForm({
        first_name: '', last_name: '', gender: 'O', birth_date: '', death_date: '',
        birth_place: '', death_place: '', occupation: '', biography: '',
        mother: '', father: '', adoptive_mother: '', adoptive_father: '',
        spouse: '', husband: '', wife: '', photo: null
      })
      setEditing(true)
    }
  }, [person, open])

  if (!open) return null

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
        if (form.photo instanceof File) {
          formData.append('photo', form.photo)
        }
      } else {
        const value = form[key] === null ? '' : form[key]
        formData.append(key, value)
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          {!editing && person ? (
            <div className="modal-view">
              <div className="modal-header-flex" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                {person.photo_url && <img src={person.photo_url} className="modal-photo" alt="" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />}
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>
                    {person.first_name} {person.last_name} {person.death_date && "🕊️"}
                  </h2>
                  <p className="modal-subtitle" style={{ margin: 0, color: '#666' }}>
                    {person.gender === 'M' ? copy.modalGenderMale : person.gender === 'F' ? copy.modalGenderFemale : copy.modalGenderOther}
                  </p>
                </div>
              </div>
              <div className="modal-details-grid" style={{ lineHeight: '1.6' }}>
                <p><b>{copy.modalBorn}:</b> {person.birth_date || '—'}</p>
                <p><b>{copy.modalDied}:</b> {person.death_date || '—'}</p>
                <p><b>{copy.birthPlace}:</b> {person.birth_place || '—'}</p>
                <p><b>{copy.deathPlace}:</b> {person.death_place || '—'}</p>
                <p><b>{copy.occupation}:</b> {person.occupation || '—'}</p>
                <p><b>{copy.father}:</b> {person.father_name || '—'}</p>
                <p><b>{copy.mother}:</b> {person.mother_name || '—'}</p>
                <p><b>{toolsCopy.adoptiveMother}:</b> {person.adoptive_mother_name || '—'}</p>
                <p><b>{toolsCopy.adoptiveFather}:</b> {person.adoptive_father_name || '—'}</p>
                <p><b>{copy.modalSpouse}:</b> {person.spouse_name || '—'}</p>
                <p><b>{copy.modalHusband}:</b> {person.husband_name || '—'}</p>
                <p><b>{toolsCopy.wifeLabel}:</b> {person.wife_name || '—'}</p>
                <p><b>{copy.biography}:</b> {person.biography || '—'}</p>
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button className="btn-edit" onClick={() => setEditing(true)}>{copy.modalEdit}</button>
                <button className="btn-delete" onClick={() => onDelete(person.id)} style={{ backgroundColor: '#dc3545', color: '#fff' }}>{copy.modalDelete}</button>
                <button className="btn-close" onClick={onClose} style={{ marginLeft: 'auto' }}>{copy.modalClose}</button>
              </div>
            </div>
          ) : (
            <div className="person-form">
              <h3>{person ? copy.modalEdit : copy.formTitle}</h3>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.firstName}</label>
                  <input name="first_name" placeholder={copy.firstName} value={form.first_name} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.lastName}</label>
                  <input name="last_name" placeholder={copy.lastName} value={form.last_name} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.gender}</label>
                  <select name="gender" value={form.gender} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="M">{copy.male}</option>
                    <option value="F">{copy.female}</option>
                    <option value="O">{copy.other}</option>
                  </select>
                </div>
                <div></div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.birthDate}</label>
                  <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.deathDate}</label>
                  <input type="date" name="death_date" value={form.death_date} onChange={handleChange} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.birthPlace}</label>
                  <input name="birth_place" placeholder={copy.birthPlace} value={form.birth_place} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.deathPlace}</label>
                  <input name="death_place" placeholder={copy.deathPlace} value={form.death_place} onChange={handleChange} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.occupation}</label>
                  <input name="occupation" placeholder={copy.occupation} value={form.occupation} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div></div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.biography}</label>
                  <textarea
                    name="biography"
                    placeholder={copy.biography}
                    value={form.biography}
                    onChange={handleChange}
                    rows={3}
                    style={{ width: '100%', border: '1px solid #d7dce3', borderRadius: '10px', padding: '10px 12px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.father}</label>
                  <select name="father" value={form.father} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.filter(p => p.gender === 'M').map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.mother}</label>
                  <select name="mother" value={form.mother} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.filter(p => p.gender === 'F').map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{toolsCopy.adoptiveMother}</label>
                  <select name="adoptive_mother" value={form.adoptive_mother} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.filter(p => p.gender === 'F').map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{toolsCopy.adoptiveFather}</label>
                  <select name="adoptive_father" value={form.adoptive_father} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.filter(p => p.gender === 'M').map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.modalSpouse}</label>
                  <select name="spouse" value={form.spouse} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{copy.modalHusband}</label>
                  <select name="husband" value={form.husband} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#666' }}>{toolsCopy.wifeLabel}</label>
                  <select name="wife" value={form.wife} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">{copy.none}</option>
                    {others.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                </div>
                
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{copy.photo}</label>
                  <input type="file" onChange={handleFile} accept="image/*" />
                </div>
              </div>
              <div className="form-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-save" onClick={handleSubmit} disabled={isSaving} style={{ backgroundColor: '#28a745', color: '#fff' }}>
                  {isSaving ? copy.saving : copy.save}
                </button>
                <button className="btn-cancel" onClick={() => person ? setEditing(false) : onClose()}>{copy.cancel}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [language, setLanguage] = useState('ar')
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [timelineItems, setTimelineItems] = useState([])
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [directoryPeople, setDirectoryPeople] = useState([])
  const [smartSearchEnabled, setSmartSearchEnabled] = useState(true)
  const [resultLimit, setResultLimit] = useState(400)
  const [advancedFilters, setAdvancedFilters] = useState({
    birth_from: '',
    birth_to: '',
    death_from: '',
    death_to: '',
    location: '',
    living: 'all',
    branch_root: '',
    branch_depth: '',
  })
  const [relationships, setRelationships] = useState([])
  const [relationshipPersonFilter, setRelationshipPersonFilter] = useState('')
  const [relationshipForm, setRelationshipForm] = useState({
    person1: '',
    person2: '',
    relationship_type: 'MARRIAGE',
    status: 'ACTIVE',
    start_date: '',
    end_date: '',
    notes: '',
  })
  const [editingRelationshipId, setEditingRelationshipId] = useState(null)
  const [duplicatePairs, setDuplicatePairs] = useState([])
  const [duplicateThreshold, setDuplicateThreshold] = useState('0.82')
  const [duplicateScanLoading, setDuplicateScanLoading] = useState(false)
  const [collapsedAdvancedCards, setCollapsedAdvancedCards] = useState({
    filters: false,
    relationships: false,
    quality: false,
  })
  const [backgroundColor, setBackgroundColor] = useState(() => {
    try {
      const stored = window.localStorage.getItem(BG_STORAGE_KEY)
      return stored || BACKGROUND_SWATCHES[0]
    } catch (error) {
      console.error(error)
      return BACKGROUND_SWATCHES[0]
    }
  })
  const [nodeShape, setNodeShape] = useState(() => getStoredValue(SHAPE_STORAGE_KEY, SHAPE_OPTIONS[0], SHAPE_OPTIONS))
  const [treeOrientation, setTreeOrientation] = useState(() => getStoredValue(ORIENTATION_STORAGE_KEY, ORIENTATION_OPTIONS[0], ORIENTATION_OPTIONS))
  const [treeRenderMode, setTreeRenderMode] = useState(() => getStoredValue(RENDER_MODE_STORAGE_KEY, RENDER_MODE_OPTIONS[0], RENDER_MODE_OPTIONS))
  const [threeLabelDensity, setThreeLabelDensity] = useState(() => getStoredValue(LABEL_DENSITY_STORAGE_KEY, LABEL_DENSITY_OPTIONS[0], LABEL_DENSITY_OPTIONS))
  const [isPaletteOpen, setIsPaletteOpen] = useState(true)
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false)
  const [birthdayWindowDays, setBirthdayWindowDays] = useState(7)
  const languageMenuRef = useRef(null)
  const shapeMenuRef = useRef(null)
  const [isBirthdayReminderDismissed, setIsBirthdayReminderDismissed] = useState(() => {
    try {
      const todayKey = new Date().toISOString().slice(0, 10)
      return Boolean(window.localStorage.getItem(`${BIRTHDAY_REMINDER_STORAGE_KEY}_${todayKey}_7`))
    } catch (error) {
      console.error(error)
      return false
    }
  })
  const birthdayCopy = BIRTHDAY_COPY[language]
  const birthdayPanelCopy = BIRTHDAY_PANEL_COPY[language]
  const birthdayPeople = useMemo(() => people.filter(isBirthdayToday).sort((left, right) => {
    const leftName = `${left.last_name || ''} ${left.first_name || ''}`.trim().toLowerCase()
    const rightName = `${right.last_name || ''} ${right.first_name || ''}`.trim().toLowerCase()
    return leftName.localeCompare(rightName)
  }), [people])
  const birthdayPersonIds = useMemo(() => new Set(birthdayPeople.map(person => String(person.id))), [birthdayPeople])
  const upcomingBirthdayPeople = useMemo(() => {
    const today = new Date()
    return people
      .filter(person => !person.death_date)
      .map(person => ({ person, daysUntil: getDaysUntilBirthday(person, today) }))
      .filter(entry => entry.daysUntil !== null && entry.daysUntil > 0 && entry.daysUntil <= birthdayWindowDays)
      .sort((left, right) => left.daysUntil - right.daysUntil || `${left.person.last_name || ''} ${left.person.first_name || ''}`.localeCompare(`${right.person.last_name || ''} ${right.person.first_name || ''}`))
  }, [people, birthdayWindowDays])
  const upcomingReminderKey = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    return `${BIRTHDAY_REMINDER_STORAGE_KEY}_${todayKey}_${birthdayWindowDays}`
  }, [birthdayWindowDays])
  const shouldShowBirthdayReminder = birthdayPeople.length > 0 || upcomingBirthdayPeople.length > 0

  const copy = UI_COPY[language]
  const toolsCopy = TOOLS_COPY[language] || TOOLS_COPY.en
  const renderModeCopy = RENDER_MODE_COPY[language] || RENDER_MODE_COPY.en
  const labelDensityCopy = LABEL_DENSITY_COPY[language] || LABEL_DENSITY_COPY.en
  const selectedLanguageOption = LANGUAGE_OPTIONS.find(option => option.code === language) || LANGUAGE_OPTIONS[0]
  const selectedShapeLabel = getShapeLabel(nodeShape, copy)

  const handleResetTheme = () => {
    setBackgroundColor(BACKGROUND_SWATCHES[0])
    setNodeShape(SHAPE_OPTIONS[0])
    setTreeOrientation(ORIENTATION_OPTIONS[0])
    setTreeRenderMode(RENDER_MODE_OPTIONS[0])
    setThreeLabelDensity(LABEL_DENSITY_OPTIONS[0])
  }

  const toggleAdvancedCard = (cardKey) => {
    setCollapsedAdvancedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }))
  }

  const buildPeopleParams = () => {
    const params = {
      smart: smartSearchEnabled ? '1' : '0',
      limit: String(resultLimit || 400),
    }

    const queryValue = searchQuery.trim()
    if (queryValue) params.q = queryValue

    Object.entries(advancedFilters).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined && value !== 'all') {
        params[key] = value
      }
    })

    return params
  }

  const fetchPeople = async ({ retries = 1, retryDelayMs = 0, overrideParams = null } = {}) => {
    let lastError = null

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const params = overrideParams || buildPeopleParams()
        const res = await axios.get(`${API_BASE_URL}/api/people/`, { timeout: 6000, params })
        setPeople(res.data)
        return true
      } catch (err) {
        lastError = err
        const shouldRetry = attempt < retries
        if (shouldRetry) {
          await wait(retryDelayMs)
        }
      }
    }

    console.error('Error fetching people:', lastError)
    return false
  }

  const fetchDirectoryPeople = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/people/`, {
        timeout: 6000,
        params: { smart: '0', limit: '1000' },
      })
      setDirectoryPeople(res.data || [])
    } catch (error) {
      console.error(error)
    }
  }

  const fetchRelationships = async (personId = relationshipPersonFilter) => {
    try {
      const params = {}
      if (personId) params.person = personId
      const res = await axios.get(`${API_BASE_URL}/api/relationships/`, {
        timeout: 6000,
        params,
      })
      setRelationships(res.data || [])
    } catch (error) {
      console.error(error)
    }
  }

  const refreshAllData = async () => {
    await Promise.all([
      fetchPeople({ retries: 3, retryDelayMs: 500 }),
      fetchDirectoryPeople(),
      fetchStatsAndTimeline(),
      fetchRelationships(),
    ])
  }

  const fetchStatsAndTimeline = async () => {
    try {
      const [statsRes, timelineRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/stats/`, { timeout: 4000 }),
        axios.get(`${API_BASE_URL}/api/timeline/`, { timeout: 4000 }),
      ])
      setStats(statsRes.data)
      setTimelineItems((timelineRes.data || []).slice(-8).reverse())
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    let isMounted = true

    const loadInitialPeople = async () => {
      setLoading(true)
      const ok = await fetchPeople({
        retries: INITIAL_BACKEND_RETRIES,
        retryDelayMs: INITIAL_BACKEND_RETRY_DELAY_MS,
      })
      if (ok) {
        await Promise.all([
          fetchStatsAndTimeline(),
          fetchDirectoryPeople(),
          fetchRelationships(),
        ])
      }

      if (isMounted) {
        setLoading(false)
      }

      if (!ok) {
        console.error('Backend did not become available in time.')
      }
    }

    loadInitialPeople()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const timeoutId = setTimeout(() => {
      fetchPeople({ retries: 2, retryDelayMs: 250 })
    }, 260)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, smartSearchEnabled, resultLimit, advancedFilters, loading])

  useEffect(() => {
    if (loading) return
    fetchRelationships(relationshipPersonFilter)
  }, [relationshipPersonFilter, loading])

  useEffect(() => {
    try {
      window.localStorage.setItem(BG_STORAGE_KEY, backgroundColor)
      document.body.style.backgroundColor = backgroundColor
    } catch (error) {
      console.error(error)
    }
  }, [backgroundColor])

  useEffect(() => {
    try {
      window.localStorage.setItem(SHAPE_STORAGE_KEY, nodeShape)
    } catch (error) {
      console.error(error)
    }
  }, [nodeShape])

  useEffect(() => {
    try {
      window.localStorage.setItem(ORIENTATION_STORAGE_KEY, treeOrientation)
    } catch (error) {
      console.error(error)
    }
  }, [treeOrientation])

  useEffect(() => {
    try {
      window.localStorage.setItem(RENDER_MODE_STORAGE_KEY, treeRenderMode)
    } catch (error) {
      console.error(error)
    }
  }, [treeRenderMode])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target)) {
        setIsLanguageMenuOpen(false)
      }
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target)) {
        setIsShapeMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(LABEL_DENSITY_STORAGE_KEY, threeLabelDensity)
    } catch (error) {
      console.error(error)
    }
  }, [threeLabelDensity])

  useEffect(() => {
    try {
      setIsBirthdayReminderDismissed(Boolean(window.localStorage.getItem(upcomingReminderKey)))
    } catch (error) {
      console.error(error)
    }
  }, [upcomingReminderKey])

  useEffect(() => {
    if (birthdayPeople.length === 0) return

    try {
      const todayKey = new Date().toISOString().slice(0, 10)
      const notificationKey = `familytree_birthday_notification_${todayKey}`
      if (window.localStorage.getItem(notificationKey)) return

      if ('Notification' in window && Notification.permission === 'granted') {
        const names = birthdayPeople.map(person => `${person.first_name} ${person.last_name}`.trim()).join(', ')
        new Notification(birthdayCopy.title, {
          body: `${names} ${birthdayPeople.length === 1 ? birthdayCopy.singular : birthdayCopy.plural}`,
        })
      }

      window.localStorage.setItem(notificationKey, '1')
    } catch (error) {
      console.error(error)
    }
  }, [birthdayPeople, birthdayCopy.title, birthdayCopy.singular, birthdayCopy.plural])

  const dismissBirthdayReminder = () => {
    try {
      window.localStorage.setItem(upcomingReminderKey, '1')
    } catch (error) {
      console.error(error)
    }
    setIsBirthdayReminderDismissed(true)
  }

  const handleSave = async (formData, id) => {
    const url = id ? `${API_BASE_URL}/api/people/${id}/` : `${API_BASE_URL}/api/people/`
    const method = id ? 'patch' : 'post'
    
    try {
      await axios({ method, url, data: formData, headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshAllData()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
      throw error
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(copy.deleteConfirm)) return
    try {
      await axios.delete(`${API_BASE_URL}/api/people/${id}/`)
      setModalOpen(false)
      await refreshAllData()
    } catch (error) {
      alert("Delete failed:\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/export/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'family_tree_backup.zip')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + error.message)
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!window.confirm(copy.importConfirm)) return
    
    const formData = new FormData()
    formData.append('backup', file)
    
    try {
      await axios.post(`${API_BASE_URL}/api/import/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert("Imported successfully. Reloading Data...")
      await refreshAllData()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const handleExportGedcom = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/export-gedcom/`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'family_tree.ged')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + error.message)
    }
  }

  const handleImportGedcom = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('gedcom', file)
    try {
      await axios.post(`${API_BASE_URL}/api/import-gedcom/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      await refreshAllData()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const handleRelationshipFormChange = (event) => {
    const { name, value } = event.target
    setRelationshipForm(prev => ({ ...prev, [name]: value }))
  }

  const resetRelationshipForm = () => {
    setRelationshipForm({
      person1: '',
      person2: '',
      relationship_type: 'MARRIAGE',
      status: 'ACTIVE',
      start_date: '',
      end_date: '',
      notes: '',
    })
    setEditingRelationshipId(null)
  }

  const editRelationship = (relationship) => {
    setEditingRelationshipId(relationship.id)
    setRelationshipForm({
      person1: String(relationship.person1 || ''),
      person2: String(relationship.person2 || ''),
      relationship_type: relationship.relationship_type || 'MARRIAGE',
      status: relationship.status || 'ACTIVE',
      start_date: relationship.start_date || '',
      end_date: relationship.end_date || '',
      notes: relationship.notes || '',
    })
  }

  const submitRelationship = async () => {
    if (!relationshipForm.person1 || !relationshipForm.person2) {
      alert(toolsCopy.relationshipsSelectTwoPeople)
      return
    }

    const payload = {
      ...relationshipForm,
      person1: Number.parseInt(relationshipForm.person1, 10),
      person2: Number.parseInt(relationshipForm.person2, 10),
    }

    if (!payload.start_date) payload.start_date = null
    if (!payload.end_date) payload.end_date = null

    try {
      if (editingRelationshipId) {
        await axios.patch(`${API_BASE_URL}/api/relationships/${editingRelationshipId}/`, payload)
      } else {
        await axios.post(`${API_BASE_URL}/api/relationships/`, payload)
      }
      resetRelationshipForm()
      await Promise.all([
        fetchRelationships(),
        fetchPeople({ retries: 2, retryDelayMs: 200 }),
        fetchDirectoryPeople(),
      ])
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const deleteRelationship = async (relationshipId) => {
    if (!window.confirm(toolsCopy.relationshipsDeleteConfirm)) return
    try {
      await axios.delete(`${API_BASE_URL}/api/relationships/${relationshipId}/`)
      await Promise.all([
        fetchRelationships(),
        fetchPeople({ retries: 2, retryDelayMs: 200 }),
        fetchDirectoryPeople(),
      ])
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const scanDuplicates = async () => {
    setDuplicateScanLoading(true)
    try {
      const response = await axios.get(`${API_BASE_URL}/api/people/duplicates/`, {
        params: { threshold: duplicateThreshold || '0.82' },
      })
      setDuplicatePairs(response.data?.pairs || [])
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    } finally {
      setDuplicateScanLoading(false)
    }
  }

  const mergeDuplicatePair = async (pair) => {
    const primaryId = pair.left?.id
    const duplicateId = pair.right?.id
    if (!primaryId || !duplicateId) return

    const confirmMessage = toolsCopy.duplicatesConfirmMerge
      .replace('{from}', pair.right?.name || '')
      .replace('{to}', pair.left?.name || '')
    if (!window.confirm(confirmMessage)) return

    try {
      await axios.post(`${API_BASE_URL}/api/people/merge/`, {
        primary_id: primaryId,
        duplicate_ids: [duplicateId],
      })
      await refreshAllData()
      await scanDuplicates()
    } catch (error) {
      alert(copy.requestFailed + ":\n" + JSON.stringify(error.response?.data || error.message))
    }
  }

  const filteredPeople = people

  return (
    <div
      className={`app-container ${language === 'ar' ? 'rtl' : 'ltr'}`}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      style={{ '--app-bg': backgroundColor }}
    >
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
            <button
              type="button"
              className="dropdown-trigger language-trigger"
              onClick={() => {
                setIsShapeMenuOpen(false)
                setIsLanguageMenuOpen(prev => !prev)
              }}
            >
              <img src={selectedLanguageOption.flag} alt={selectedLanguageOption.label} className="language-flag-icon" />
              <span>{selectedLanguageOption.label}</span>
              <span className="dropdown-caret">▾</span>
            </button>
            {isLanguageMenuOpen && (
              <div className="dropdown-panel language-panel" role="listbox" aria-label="Language options">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className={`dropdown-option ${language === option.code ? 'active' : ''}`}
                    onClick={() => {
                      setLanguage(option.code)
                      setIsLanguageMenuOpen(false)
                    }}
                  >
                    <img src={option.flag} alt={option.label} className="language-flag-icon" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-lang header-action-btn" onClick={handleExport}>
            <img src={exportIcon} alt="" className="header-action-icon" />
            {copy.exportTree}
          </button>
          <button className="btn-lang header-action-btn" onClick={() => document.getElementById('import-zip-input').click()}>
            <img src={importIcon} alt="" className="header-action-icon" />
            {copy.importTree}
          </button>
          <input id="import-zip-input" type="file" accept=".zip" onChange={handleImport} style={{ display: 'none' }} />
          <button className="btn-lang header-action-btn" onClick={handleExportGedcom}>
            <img src={exportIcon} alt="" className="header-action-icon" />
            {copy.exportGedcom}
          </button>
          <button className="btn-lang header-action-btn" onClick={() => document.getElementById('import-gedcom-input').click()}>
            <img src={importIcon} alt="" className="header-action-icon" />
            {copy.importGedcom}
          </button>
          <input id="import-gedcom-input" type="file" accept=".ged,.txt" onChange={handleImportGedcom} style={{ display: 'none' }} />
          <button className="btn-primary add-member-btn" onClick={() => { setSelectedPerson(null); setModalOpen(true); }}>
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
        {shouldShowBirthdayReminder && !isBirthdayReminderDismissed && (
          <section className="birthday-reminder-panel" aria-live="polite">
            <div className="birthday-reminder-header">
              <div>
                <div className="birthday-reminder-title">🎉 {birthdayPanelCopy.title}</div>
                <div className="birthday-reminder-subtitle">
                  {birthdayWindowDays === 7 ? birthdayPanelCopy.next7 : birthdayPanelCopy.next30}
                </div>
              </div>
              <button type="button" className="birthday-reminder-dismiss" onClick={dismissBirthdayReminder}>
                {birthdayPanelCopy.dismiss}
              </button>
            </div>

            <div className="birthday-reminder-range-switcher" role="tablist" aria-label={birthdayPanelCopy.rangeSelectorLabel}>
              {BIRTHDAY_WINDOW_OPTIONS.map(days => (
                <button
                  key={days}
                  type="button"
                  className={`birthday-reminder-range-btn ${birthdayWindowDays === days ? 'active' : ''}`}
                  onClick={() => setBirthdayWindowDays(days)}
                >
                  {days === 7 ? birthdayPanelCopy.range7 : birthdayPanelCopy.range30}
                </button>
              ))}
            </div>

            {birthdayPeople.length > 0 && (
              <div className="birthday-reminder-section">
                <div className="birthday-reminder-section-title">{birthdayPanelCopy.todayTitle}</div>
                <div className="birthday-banner-list">
                  {birthdayPeople.map(person => {
                    const age = getBirthdayAge(person)
                    return (
                      <button
                        key={person.id}
                        type="button"
                        className="birthday-chip"
                        onClick={() => {
                          setSelectedPerson(person)
                          setModalOpen(true)
                        }}
                      >
                        <span>{person.first_name} {person.last_name}</span>
                        {age ? <span className="birthday-chip-age">{birthdayPanelCopy.ageToday} {age}</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="birthday-reminder-section">
              <div className="birthday-reminder-section-title">
                {birthdayPanelCopy.upcomingTitle} ({upcomingBirthdayPeople.length})
              </div>
              {upcomingBirthdayPeople.length === 0 ? (
                <div className="birthday-reminder-empty">{birthdayPanelCopy.empty}</div>
              ) : (
                <div className="birthday-reminder-list">
                  {upcomingBirthdayPeople.map(({ person, daysUntil }) => {
                    const age = getBirthdayAge(person)
                    return (
                      <button
                        key={person.id}
                        type="button"
                        className="birthday-reminder-item"
                        onClick={() => {
                          setSelectedPerson(person)
                          setModalOpen(true)
                        }}
                      >
                        <span className="birthday-list-name">{person.first_name} {person.last_name}</span>
                        <span className="birthday-list-meta">
                          {birthdayPanelCopy.inDays.replace('{days}', daysUntil)}{age ? ` · ${age}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        <section className={`tree-controls ${isPaletteOpen ? 'is-open' : ''}`} aria-label="Tree controls">
          <button
            type="button"
            className="advanced-card-toggle tree-controls-toggle"
            onClick={() => setIsPaletteOpen(prev => !prev)}
            aria-expanded={isPaletteOpen}
            title={isPaletteOpen ? copy.paletteToggleClose : copy.paletteToggleOpen}
          >
            <span className={`advanced-card-toggle-icon ${!isPaletteOpen ? 'is-collapsed' : ''}`}>▾</span>
          </button>

          <div className="palette-group">
            <p className="palette-title">{copy.backgroundPalette}</p>
            <div className="palette-row">
              {BACKGROUND_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch-btn ${backgroundColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  aria-label={`Background ${color}`}
                  onClick={() => setBackgroundColor(color)}
                />
              ))}
            </div>
            <div className="palette-color-picker-row">
              <label className="palette-color-picker-label">{copy.customColor}</label>
              <input
                type="color"
                value={backgroundColor}
                className="palette-color-picker"
                onChange={(e) => setBackgroundColor(e.target.value)}
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
                  onClick={() => {
                    setIsLanguageMenuOpen(false)
                    setIsShapeMenuOpen(prev => !prev)
                  }}
                >
                  <span className={getShapeIconClass(nodeShape)} aria-hidden="true" />
                  <span>{selectedShapeLabel}</span>
                  <span className="dropdown-caret">▾</span>
                </button>

                {isShapeMenuOpen && (
                  <div className="dropdown-panel shape-panel" role="listbox" aria-label="Shape options">
                    {SHAPE_OPTIONS.map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        className={`dropdown-option ${nodeShape === shape ? 'active' : ''}`}
                        onClick={() => {
                          setNodeShape(shape)
                          setIsShapeMenuOpen(false)
                        }}
                      >
                        <span className={getShapeIconClass(shape)} aria-hidden="true" />
                        <span>{getShapeLabel(shape, copy)}</span>
                      </button>
                    ))}
                  </div>
                )}
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
                  className={`shape-btn ${treeOrientation === orientation ? 'active' : ''}`}
                  onClick={() => setTreeOrientation(orientation)}
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
                  className={`render-mode-toggle ${treeRenderMode === '3d' ? 'is-on' : ''}`}
                  onClick={() => setTreeRenderMode(treeRenderMode === '3d' ? '2d' : '3d')}
                  aria-label="Toggle render mode"
                >
                  <span className="render-mode-label render-mode-label-left">{renderModeCopy.mode2d}</span>
                  <span className="render-mode-label render-mode-label-right">{renderModeCopy.mode3d}</span>
                  <span className="render-mode-toggle-knob" />
                </button>
              </div>
            </div>
            {treeRenderMode === '3d' && (
              <>
                <p className="palette-title palette-subtitle">{labelDensityCopy.title}</p>
                <div className="palette-row">
                  {LABEL_DENSITY_OPTIONS.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`shape-btn ${threeLabelDensity === mode ? 'active' : ''}`}
                      onClick={() => setThreeLabelDensity(mode)}
                    >
                      <span>
                        {mode === 'all'
                          ? labelDensityCopy.all
                          : mode === 'hide-deep'
                            ? labelDensityCopy.hideDeep
                            : labelDensityCopy.namesOnly}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="palette-reset-row">
              <button type="button" className="btn-reset-theme" onClick={handleResetTheme}>
                {copy.resetTheme}
              </button>
            </div>
          </div>
        </section>

        <section className="advanced-tools-grid">
          <div className={`palette-group advanced-tools-card ${collapsedAdvancedCards.filters ? 'is-collapsed' : ''}`}>
            <div className="advanced-tools-card-header">
              <p className="palette-title">{toolsCopy.filtersTitle}</p>
              <button
                type="button"
                className="advanced-card-toggle"
                onClick={() => toggleAdvancedCard('filters')}
                aria-expanded={!collapsedAdvancedCards.filters}
                title={`${collapsedAdvancedCards.filters ? toolsCopy.panelShow : toolsCopy.panelHide} ${toolsCopy.filtersTitle}`}
              >
                <span className={`advanced-card-toggle-icon ${collapsedAdvancedCards.filters ? 'is-collapsed' : ''}`}>▾</span>
              </button>
            </div>
            <div className="advanced-tools-card-body">
              <div className="advanced-tools-fields">
              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersSmart}</span>
                <input
                  type="checkbox"
                  checked={smartSearchEnabled}
                  onChange={(event) => setSmartSearchEnabled(event.target.checked)}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersLimit}</span>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={resultLimit}
                  onChange={(event) => setResultLimit(Number.parseInt(event.target.value || '400', 10))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersLiving}</span>
                <select
                  value={advancedFilters.living}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, living: event.target.value }))}
                >
                  <option value="all">{toolsCopy.filtersAll}</option>
                  <option value="living">{toolsCopy.filtersLivingOnly}</option>
                  <option value="deceased">{toolsCopy.filtersDeceasedOnly}</option>
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersLocation}</span>
                <input
                  type="text"
                  value={advancedFilters.location}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, location: event.target.value }))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersBirthFrom}</span>
                <input
                  type="date"
                  value={advancedFilters.birth_from}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, birth_from: event.target.value }))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersBirthTo}</span>
                <input
                  type="date"
                  value={advancedFilters.birth_to}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, birth_to: event.target.value }))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersDeathFrom}</span>
                <input
                  type="date"
                  value={advancedFilters.death_from}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, death_from: event.target.value }))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersDeathTo}</span>
                <input
                  type="date"
                  value={advancedFilters.death_to}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, death_to: event.target.value }))}
                />
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersBranch}</span>
                <select
                  value={advancedFilters.branch_root}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, branch_root: event.target.value }))}
                >
                  <option value="">{copy.none}</option>
                  {directoryPeople.map(person => (
                    <option key={person.id} value={person.id}>
                      {person.first_name} {person.last_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.filtersBranchDepth}</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={advancedFilters.branch_depth}
                  onChange={(event) => setAdvancedFilters(prev => ({ ...prev, branch_depth: event.target.value }))}
                />
              </label>
            </div>

              <button
                type="button"
                className="btn-reset-theme"
                onClick={() => {
                  setAdvancedFilters({
                    birth_from: '',
                    birth_to: '',
                    death_from: '',
                    death_to: '',
                    location: '',
                    living: 'all',
                    branch_root: '',
                    branch_depth: '',
                  })
                  setSmartSearchEnabled(true)
                  setResultLimit(400)
                }}
              >
                {toolsCopy.filtersReset}
              </button>
            </div>
          </div>

          <div className={`palette-group advanced-tools-card ${collapsedAdvancedCards.relationships ? 'is-collapsed' : ''}`}>
            <div className="advanced-tools-card-header">
              <p className="palette-title">{toolsCopy.relationshipsTitle}</p>
              <button
                type="button"
                className="advanced-card-toggle"
                onClick={() => toggleAdvancedCard('relationships')}
                aria-expanded={!collapsedAdvancedCards.relationships}
                title={`${collapsedAdvancedCards.relationships ? toolsCopy.panelShow : toolsCopy.panelHide} ${toolsCopy.relationshipsTitle}`}
              >
                <span className={`advanced-card-toggle-icon ${collapsedAdvancedCards.relationships ? 'is-collapsed' : ''}`}>▾</span>
              </button>
            </div>
            <div className="advanced-tools-card-body">
              <div className="advanced-tools-fields">
              <label className="advanced-tools-field">
                <span>{toolsCopy.relationshipsFilterPerson}</span>
                <select
                  value={relationshipPersonFilter}
                  onChange={(event) => setRelationshipPersonFilter(event.target.value)}
                >
                  <option value="">{copy.none}</option>
                  {directoryPeople.map(person => (
                    <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                  ))}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.relationshipsPerson1}</span>
                <select name="person1" value={relationshipForm.person1} onChange={handleRelationshipFormChange}>
                  <option value="">{copy.none}</option>
                  {directoryPeople.map(person => (
                    <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                  ))}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.relationshipsPerson2}</span>
                <select name="person2" value={relationshipForm.person2} onChange={handleRelationshipFormChange}>
                  <option value="">{copy.none}</option>
                  {directoryPeople.map(person => (
                    <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                  ))}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.relationshipsType}</span>
                <select name="relationship_type" value={relationshipForm.relationship_type} onChange={handleRelationshipFormChange}>
                  {RELATIONSHIP_TYPE_OPTIONS.map(value => <option key={value} value={value}>{getRelationshipTypeLabel(value, toolsCopy)}</option>)}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{toolsCopy.relationshipsStatus}</span>
                <select name="status" value={relationshipForm.status} onChange={handleRelationshipFormChange}>
                  {RELATIONSHIP_STATUS_OPTIONS.map(value => <option key={value} value={value}>{getRelationshipStatusLabel(value, toolsCopy)}</option>)}
                </select>
              </label>

              <label className="advanced-tools-field">
                <span>{copy.birthDate}</span>
                <input type="date" name="start_date" value={relationshipForm.start_date} onChange={handleRelationshipFormChange} />
              </label>

              <label className="advanced-tools-field">
                <span>{copy.deathDate}</span>
                <input type="date" name="end_date" value={relationshipForm.end_date} onChange={handleRelationshipFormChange} />
              </label>

              <label className="advanced-tools-field advanced-tools-field-wide">
                <span>{toolsCopy.relationshipsNotes}</span>
                <textarea name="notes" rows="2" value={relationshipForm.notes} onChange={handleRelationshipFormChange} />
              </label>
              </div>

              <div className="advanced-tools-actions">
                <button type="button" className="btn-primary" onClick={submitRelationship}>
                  {editingRelationshipId ? toolsCopy.relationshipsUpdate : toolsCopy.relationshipsAdd}
                </button>
                {editingRelationshipId ? (
                  <button type="button" className="btn-cancel" onClick={resetRelationshipForm}>
                    {toolsCopy.relationshipsCancel}
                  </button>
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
                      <button type="button" className="btn-edit" onClick={() => editRelationship(relationship)}>{copy.modalEdit}</button>
                      <button type="button" className="btn-delete" onClick={() => deleteRelationship(relationship.id)}>{toolsCopy.relationshipsDelete}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`palette-group advanced-tools-card ${collapsedAdvancedCards.quality ? 'is-collapsed' : ''}`}>
            <div className="advanced-tools-card-header">
              <p className="palette-title">{toolsCopy.duplicatesTitle}</p>
              <button
                type="button"
                className="advanced-card-toggle"
                onClick={() => toggleAdvancedCard('quality')}
                aria-expanded={!collapsedAdvancedCards.quality}
                title={`${collapsedAdvancedCards.quality ? toolsCopy.panelShow : toolsCopy.panelHide} ${toolsCopy.duplicatesTitle}`}
              >
                <span className={`advanced-card-toggle-icon ${collapsedAdvancedCards.quality ? 'is-collapsed' : ''}`}>▾</span>
              </button>
            </div>
            <div className="advanced-tools-card-body">
              <div className="advanced-tools-fields">
              <label className="advanced-tools-field">
                <span>{toolsCopy.duplicatesThreshold}</span>
                <input
                  type="number"
                  min="0.60"
                  max="0.98"
                  step="0.01"
                  value={duplicateThreshold}
                  onChange={(event) => setDuplicateThreshold(event.target.value)}
                />
              </label>
              <button type="button" className="btn-primary" onClick={scanDuplicates} disabled={duplicateScanLoading}>
                {duplicateScanLoading ? copy.saving : toolsCopy.duplicatesScan}
              </button>
              </div>

              <div className="advanced-tools-list">
                {duplicatePairs.length === 0 ? (
                  <div className="dashboard-empty">{toolsCopy.duplicatesNone}</div>
                ) : duplicatePairs.map((pair, index) => (
                  <div key={`${pair.left?.id}-${pair.right?.id}-${index}`} className="advanced-list-item">
                    <div><strong>{pair.left?.name}</strong> ⇄ <strong>{pair.right?.name}</strong></div>
                    <div>Score: {pair.score}</div>
                    <div>{pair.left?.birth_date || '—'} / {pair.right?.birth_date || '—'}</div>
                    <div className="advanced-tools-actions compact">
                      <button type="button" className="btn-primary" onClick={() => mergeDuplicatePair(pair)}>
                        {toolsCopy.duplicatesMerge}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {loading ? <p>{copy.loadingPeople}</p> : (
          <FamilyTree 
            people={filteredPeople} 
            language={language} 
            backgroundColor={backgroundColor}
            nodeShape={nodeShape}
            treeOrientation={treeOrientation}
            treeRenderMode={treeRenderMode}
            threeLabelDensity={threeLabelDensity}
            birthdayPersonIds={birthdayPersonIds}
            onSelect={(p) => { setSelectedPerson(p); setModalOpen(true); }} 
          />
        )}

        {birthdayPeople.length > 0 && (
          <section className="birthday-banner" aria-live="polite">
            <div className="birthday-banner-title">🎂 {birthdayCopy.title}</div>
            <div className="birthday-banner-subtitle">
              {birthdayPeople.length === 1
                ? `${birthdayPeople.length} ${birthdayCopy.singular}`
                : `${birthdayPeople.length} ${birthdayCopy.plural}`}
            </div>
            <div className="birthday-banner-list">
              {birthdayPeople.map(person => {
                const age = getBirthdayAge(person)
                return (
                  <button
                    key={person.id}
                    type="button"
                    className="birthday-chip"
                    onClick={() => {
                      setSelectedPerson(person)
                      setModalOpen(true)
                    }}
                  >
                    <span>{person.first_name} {person.last_name}</span>
                    {age ? <span className="birthday-chip-age">{birthdayCopy.agePrefix} {age}</span> : null}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="dashboard-grid">
          <div className="palette-group">
            <p className="palette-title">{copy.statsTitle}</p>
            {stats ? (
              <div className="dashboard-value-list">
                <div>{copy.totalPeople}: {stats.total_people ?? 0}</div>
                <div>{copy.livingPeople}: {stats.living_people ?? 0}</div>
                <div>{copy.deceasedPeople}: {stats.deceased_people ?? 0}</div>
                <div>{copy.averageAge}: {stats.average_age ?? '—'}</div>
                <div>{copy.oldestAge}: {stats.oldest_age ?? '—'}</div>
              </div>
            ) : (
              <div className="dashboard-empty">—</div>
            )}
          </div>

          <div className="palette-group">
            <p className="palette-title">{birthdayCopy.title}</p>
            {birthdayPeople.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{birthdayCopy.empty}</div>
            ) : (
              <div className="birthday-list-card">
                {birthdayPeople.map(person => {
                  const age = getBirthdayAge(person)
                  return (
                    <button
                      key={person.id}
                      type="button"
                      className="birthday-list-item"
                      onClick={() => {
                        setSelectedPerson(person)
                        setModalOpen(true)
                      }}
                    >
                      <span className="birthday-list-name">{person.first_name} {person.last_name}</span>
                      <span className="birthday-list-meta">
                        {person.birth_date || '—'}{age ? ` · ${age}` : ''}
                      </span>
                    </button>
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
                    <strong>{event.date}</strong> - {event.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        person={selectedPerson} 
        people={directoryPeople} 
        onSave={handleSave} 
        onDelete={handleDelete}
        copy={copy}
        toolsCopy={toolsCopy}
      />
    </div>
  )
}

const BIRTHDAY_COPY = {
  ar: {
    title: 'أعياد الميلاد اليوم',
    empty: 'لا توجد أعياد ميلاد اليوم',
    singular: 'شخص يحتفل اليوم',
    plural: 'أشخاص يحتفلون اليوم',
    agePrefix: 'يبلغ اليوم',
  },
  en: {
    title: 'Birthdays Today',
    empty: 'No birthdays today',
    singular: 'person has a birthday today',
    plural: 'people have birthdays today',
    agePrefix: 'turns',
  },
  fr: {
    title: 'Anniversaires aujourd\'hui',
    empty: 'Aucun anniversaire aujourd\'hui',
    singular: 'personne fête son anniversaire aujourd\'hui',
    plural: 'personnes fêtent leur anniversaire aujourd\'hui',
    agePrefix: 'fête ses',
  },
}

const BIRTHDAY_PANEL_COPY = {
  ar: {
    title: 'تذكيرات أعياد الميلاد',
    next7: 'أعياد الميلاد القادمة خلال 7 أيام',
    next30: 'أعياد الميلاد القادمة خلال 30 يوما',
    dismiss: 'إخفاء',
    rangeSelectorLabel: 'فترة التذكير',
    range7: '7 أيام',
    range30: '30 يوما',
    todayTitle: 'اليوم',
    upcomingTitle: 'القادمة',
    empty: 'لا توجد أعياد ميلاد في هذه الفترة',
    inDays: 'بعد {days} يوم',
    ageToday: 'يبلغ اليوم',
  },
  en: {
    title: 'Birthday reminders',
    next7: 'Upcoming birthdays in the next 7 days',
    next30: 'Upcoming birthdays in the next 30 days',
    dismiss: 'Dismiss',
    rangeSelectorLabel: 'Reminder range',
    range7: '7 days',
    range30: '30 days',
    todayTitle: 'Today',
    upcomingTitle: 'Coming up',
    empty: 'No birthdays in this range',
    inDays: 'in {days} days',
    ageToday: 'turns',
  },
  fr: {
    title: 'Rappels d\'anniversaire',
    next7: 'Anniversaires à venir dans les 7 prochains jours',
    next30: 'Anniversaires à venir dans les 30 prochains jours',
    dismiss: 'Masquer',
    rangeSelectorLabel: 'Période de rappel',
    range7: '7 jours',
    range30: '30 jours',
    todayTitle: 'Aujourd\'hui',
    upcomingTitle: 'À venir',
    empty: 'Aucun anniversaire dans cette période',
    inDays: 'dans {days} jours',
    ageToday: 'fête ses',
  },
}