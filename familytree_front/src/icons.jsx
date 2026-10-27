// Inline SVG icons (24px grid, stroke = currentColor), so they inherit text colour and size.
// Decorative by default (aria-hidden); give the surrounding button an accessible label instead.

function Icon({ children, size = 16, className = 'icon', ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ChevronDown = props => <Icon {...props}><path d="m6 9 6 6 6-6" /></Icon>

export const Cake = props => (
  <Icon {...props}>
    <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
    <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
    <path d="M2 21h20" />
    <path d="M7 8v3M12 8v3M17 8v3" />
    <path d="M7 4h.01M12 4h.01M17 4h.01" />
  </Icon>
)

export const Gift = props => (
  <Icon {...props}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
  </Icon>
)

// Two leaves on a stem: a culturally neutral "in memory" mark for deceased people.
export const OLIVE_BRANCH_PATHS = [
  'M12 22V11',
  'M12 15c-4 0-6-3-6-7 4 0 6 3 6 7Z',
  'M12 12c3.5 0 5.5-2.5 5.5-6-3.5 0-5.5 2.5-5.5 6Z',
]
export const OliveBranch = props => (
  <Icon {...props}>{OLIVE_BRANCH_PATHS.map(d => <path key={d} d={d} />)}</Icon>
)

export const X = props => <Icon {...props}><path d="M18 6 6 18M6 6l12 12" /></Icon>

export const Check = props => <Icon {...props}><path d="M20 6 9 17l-5-5" /></Icon>

export const AlertCircle = props => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Icon>
)
