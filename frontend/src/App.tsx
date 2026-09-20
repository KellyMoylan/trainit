import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, Link, NavLink, Navigate, useNavigate } from 'react-router-dom'
import './App.css'
import { getThemePreference, setThemePreference, type ThemePreference } from './theme'
import React from 'react'

// Deployed builds get VITE_API_URL from the environment; in development it defaults to the local backend, so no .env.local is needed
const apiUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

type Role = 'trainer' | 'supervisor' | 'curator'

interface User {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  department: string | null
  bio: string | null
  role: Role
  status: 'active' | 'pending'
  organization: { id: number; name: string }
}

const canManageTeam = (user: User) => user.role === 'supervisor' || user.role === 'curator'

// performed_date is a plain calendar date; the entry timestamp is a UTC datetime without a zone marker
const formatNoteDate = (note: { performed_date: string | null; timestamp: string }) => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
  if (note.performed_date) {
    const [year, month, day] = note.performed_date.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(undefined, options)
  }
  return new Date(note.timestamp + 'Z').toLocaleDateString(undefined, options)
}

type Person = { first_name: string | null; last_name: string | null; email: string }
const fullName = (person: Person) => `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
const displayName = (person: Person) => fullName(person) || person.email
const nameWithEmail = (person: Person) => (fullName(person) ? `${fullName(person)} (${person.email})` : person.email)

function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">T</span>
      TrainIt
    </span>
  )
}

function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}

function ThemeSelect() {
  const [preference, setPreference] = useState<ThemePreference>(getThemePreference)
  return (
    <label className="theme-select">
      Theme
      <select
        value={preference}
        onChange={e => {
          const next = e.target.value as ThemePreference
          setPreference(next)
          setThemePreference(next)
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  )
}

function Layout({ user, onLogout, children }: { user: User; onLogout: () => void; children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const linkClass = ({ isActive }: { isActive: boolean }) => 'nav-link' + (isActive ? ' active' : '')

  return (
    <div className="shell">
      <aside className={'sidebar' + (menuOpen ? ' open' : '')}>
        <div className="sidebar-top">
          <Link to="/" className="brand">
            <span className="brand-mark">T</span>
            TrainIt
          </Link>
          <button className="menu-toggle small" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav className="nav" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={linkClass}>Overview</NavLink>
          <NavLink to="/animals" className={linkClass}>Animals</NavLink>
          <NavLink to="/view-plans" className={linkClass}>Training plans</NavLink>
          <NavLink to="/training-plans" className={linkClass}>New plan</NavLink>
          {canManageTeam(user) && <NavLink to="/team" className={linkClass}>Team</NavLink>}
        </nav>
        <div className="sidebar-footer">
          <NavLink
            to="/profile"
            className={({ isActive }) => 'user-link' + (isActive ? ' active' : '')}
            onClick={() => setMenuOpen(false)}
          >
            <div className="user-name">{displayName(user)}</div>
            <div className="user-meta">{user.organization.name} &middot; <span className="capitalize">{user.role}</span></div>
          </NavLink>
          <ThemeSelect />
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}

function LoginPage({ onLogin, notice }: { onLogin: (token: string) => void; notice?: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      
      if (!response.ok) {
        throw new Error('Login failed')
      }
      
      const data = await response.json()
      onLogin(data.access_token)
      navigate('/') // Redirect to landing page after successful login
    } catch {
      setError('Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back. Enter your details to continue.">
      {notice && !error && <div className="notice info">{notice}</div>}
      {error && <div className="error">{error}</div>}
      <form className="stack" onSubmit={handleSubmit}>
        <Field label="Email" htmlFor="login-email">
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="auth-alt">
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </AuthLayout>
  )
}

function SignupPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    let message = 'Signup failed. Please try again.'
    try {
      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, organization_name: organizationName }),
      })

      if (!response.ok) {
        // Show the server's reason (weak password, email already registered...) instead of a generic failure
        message = apiErrorMessage(await response.json().catch(() => null), message)
        throw new Error(message)
      }
      
      // Signup returns the user, not a token, so log in with the same credentials
      const loginResponse = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!loginResponse.ok) {
        throw new Error('Login after signup failed')
      }
      const loginData = await loginResponse.json()
      onLogin(loginData.access_token)
      navigate('/') // Redirect to landing page after successful signup
    } catch {
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start a new organization, or request to join an existing one.">
      {error && <div className="error">{error}</div>}
      <form className="stack" onSubmit={handleSubmit}>
        <div className="two-col">
          <Field label="First name" htmlFor="signup-first-name">
            <input
              id="signup-first-name"
              type="text"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </Field>
          <Field label="Last name" htmlFor="signup-last-name">
            <input
              id="signup-last-name"
              type="text"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Email" htmlFor="signup-email">
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="signup-password">
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </Field>
        <Field label="Organization name" htmlFor="signup-organization">
          <input
            id="signup-organization"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
          <span className="hint">If this organization already exists, a supervisor must approve your request.</span>
        </Field>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="auth-alt">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  )
}

function PendingApprovalPage({ user, onRefresh, onLogout }: { user: User; onRefresh: () => void; onLogout: () => void }) {
  return (
    <AuthLayout title="Waiting for approval">
      <p className="muted">
        Your request to join <strong>{user.organization.name}</strong> is waiting for a supervisor or curator to approve it.
        You'll get access as soon as they do.
      </p>
      <div className="row mt">
        <button className="primary" onClick={onRefresh}>Check again</button>
        <button onClick={onLogout}>Log out</button>
      </div>
    </AuthLayout>
  )
}

function LandingPage({ user }: { user: User }) {
  return (
    <div className="page">
      <PageHeader
        title={`Welcome, ${user.first_name || displayName(user)}`}
        subtitle={<>{user.organization.name} &middot; <span className="capitalize">{user.role}</span></>}
      />
      <div className="tile-grid">
        <Link className="tile" to="/animals">
          <h3>Animals</h3>
          <p>{canManageTeam(user) ? 'Add and edit the animals in your organization.' : 'Browse the animals in your organization.'}</p>
        </Link>
        <Link className="tile" to="/view-plans">
          <h3>Training plans</h3>
          <p>Review each plan's steps and log sessions as they happen.</p>
        </Link>
        <Link className="tile" to="/training-plans">
          <h3>New plan</h3>
          <p>Build a step-by-step training plan for an animal.</p>
        </Link>
        {canManageTeam(user) && (
          <Link className="tile" to="/team">
            <h3>Team</h3>
            <p>Approve join requests and see who has access.</p>
          </Link>
        )}
        <Link className="tile" to="/profile">
          <h3>Profile</h3>
          <p>Your name, bio, email and password.</p>
        </Link>
      </div>
    </div>
  )
}

const SPECIES_OPTIONS = [
  { value: 'Beluga Whale', label: 'Beluga Whale' },
  { value: 'Bottle Nose Dolphin', label: 'Bottle Nose Dolphin' },
  { value: 'Common Dolphin', label: 'Common Dolphin' },
  { value: 'Pacific White-sided Dolphin', label: 'Pacific White-sided Dolphin' },
  { value: 'False Killer Whale', label: 'False Killer Whale' },
  { value: 'Killer Whale', label: 'Killer Whale' },
  { value: 'Black Sea Dolphin', label: 'Black Sea Dolphin' },
  { value: 'Manatee', label: 'Manatee' },
  { value: 'California Sea Lion', label: 'California Sea Lion' },
  { value: 'Sea Otter', label: 'Sea Otter' },
  { value: 'Harbor Seal', label: 'Harbor Seal' },
  { value: 'Fur Seal', label: 'Fur Seal' },
  { value: 'Grey Seal', label: 'Grey Seal' },
  { value: 'Northern Elephant Seal', label: 'Elephant Seal' },
  { value: 'Walrus', label: 'Walrus' },
]

interface AnimalFormValues {
  name: string
  species: string
  sex: string
  birth_date: string
  location: string
}

function AnimalFields({ values, onChange, idPrefix }: {
  values: AnimalFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  idPrefix: string
}) {
  return (
    <div className="form-grid">
      <Field label="Name" htmlFor={`${idPrefix}-name`}>
        <input id={`${idPrefix}-name`} name="name" value={values.name} onChange={onChange} required />
      </Field>
      <Field label="Species" htmlFor={`${idPrefix}-species`}>
        <select id={`${idPrefix}-species`} name="species" value={values.species} onChange={onChange} required>
          <option value="" disabled>Select species</option>
          {SPECIES_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      <Field label="Sex" htmlFor={`${idPrefix}-sex`}>
        <select id={`${idPrefix}-sex`} name="sex" value={values.sex} onChange={onChange} required>
          <option value="" disabled>Select sex</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Unknown">Unknown</option>
        </select>
      </Field>
      <Field label="Birth date" htmlFor={`${idPrefix}-birth-date`}>
        <input
          id={`${idPrefix}-birth-date`}
          name="birth_date"
          type="date"
          value={values.birth_date}
          onChange={onChange}
          max={new Date().toISOString().slice(0, 10)}
        />
      </Field>
      <Field label="Location" htmlFor={`${idPrefix}-location`}>
        <input id={`${idPrefix}-location`} name="location" value={values.location} onChange={onChange} />
      </Field>
    </div>
  )
}

type Status = { ok: boolean; text: string } | null

function StatusMessage({ status }: { status: Status }) {
  if (!status) return null
  return <div className={status.ok ? 'notice' : 'error'}>{status.text}</div>
}

function apiErrorMessage(body: { detail?: string | { msg?: string }[] } | null, fallback: string): string {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  const message = Array.isArray(detail) ? detail[0]?.msg : undefined
  return message ? message.replace(/^Value error, /, '') : fallback
}

function ProfilePage({ token, user, onUserChange, onTokenChange, onLogout }: {
  token: string
  user: User
  onUserChange: (user: User) => void
  onTokenChange: (token: string) => void
  onLogout: () => void
}) {
  const [firstName, setFirstName] = useState(user.first_name ?? '')
  const [lastName, setLastName] = useState(user.last_name ?? '')
  const [department, setDepartment] = useState(user.department ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [profileStatus, setProfileStatus] = useState<Status>(null)

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailStatus, setEmailStatus] = useState<Status>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<Status>(null)

  const [saving, setSaving] = useState(false)

  const send = async (path: string, body: object) => {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (response.status === 401) {
      onLogout()
      return null
    }
    if (!response.ok) {
      throw new Error(apiErrorMessage(await response.json().catch(() => null), 'Request failed'))
    }
    return response.status === 204 ? true : response.json()
  }

  // Runs one of the three forms: shows its status message and disables the buttons while it runs
  const submit = async (
    event: React.FormEvent,
    setStatus: (status: Status) => void,
    action: () => Promise<string | null>,
  ) => {
    event.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      const message = await action()
      if (message) setStatus({ ok: true, text: message })
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Request failed' })
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = (event: React.FormEvent) => submit(event, setProfileStatus, async () => {
    const updated = await send('/auth/me', { first_name: firstName, last_name: lastName, department, bio })
    if (updated === null) return null
    onUserChange(updated)
    return 'Profile saved.'
  })

  const changeEmail = (event: React.FormEvent) => submit(event, setEmailStatus, async () => {
    const result = await send('/auth/me/email', { email: newEmail, current_password: emailPassword })
    if (result === null) return null
    setNewEmail('')
    setEmailPassword('')
    onTokenChange(result.access_token)
    return 'Email updated.'
  })

  const changePassword = (event: React.FormEvent) => submit(event, setPasswordStatus, async () => {
    if (newPassword !== confirmPassword) throw new Error('New passwords do not match')
    const result = await send('/auth/me/password', { current_password: currentPassword, new_password: newPassword })
    if (result === null) return null
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    // Changing the password ends every earlier login, including this one, so switch to the fresh token
    onTokenChange(result.access_token)
    return 'Password updated. Any other devices you were logged in on have been logged out.'
  })

  return (
    <div className="page narrow">
      <PageHeader
        title="Profile"
        subtitle={<>{user.organization.name} &middot; <span className="capitalize">{user.role}</span></>}
      />

      <form className="card" onSubmit={saveProfile}>
        <h3 className="card-title">Personal details</h3>
        <div className="stack">
          <div className="two-col">
            <Field label="First name" htmlFor="profile-first-name">
              <input id="profile-first-name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Field>
            <Field label="Last name" htmlFor="profile-last-name">
              <input id="profile-last-name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Field>
          </div>
          <Field label="Department" htmlFor="profile-department">
            <input id="profile-department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
          </Field>
          <Field label="Bio" htmlFor="profile-bio">
            <textarea id="profile-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} />
          </Field>
        </div>
        <StatusMessage status={profileStatus} />
        <div className="form-actions">
          <button type="submit" className="primary" disabled={saving}>Save changes</button>
        </div>
      </form>

      <form className="card" onSubmit={changeEmail}>
        <h3 className="card-title">Email</h3>
        <p className="muted" style={{ marginBottom: 14 }}>Your email is currently <strong>{user.email}</strong>.</p>
        <div className="stack">
          <Field label="New email" htmlFor="profile-new-email">
            <input id="profile-new-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
          </Field>
          <Field label="Current password" htmlFor="profile-email-password">
            <input id="profile-email-password" type="password" autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
          </Field>
        </div>
        <StatusMessage status={emailStatus} />
        <div className="form-actions">
          <button type="submit" disabled={saving}>Change email</button>
        </div>
      </form>

      <form className="card" onSubmit={changePassword}>
        <h3 className="card-title">Password</h3>
        <div className="stack">
          <Field label="Current password" htmlFor="profile-current-password">
            <input id="profile-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>
          <Field label="New password" htmlFor="profile-new-password">
            <input id="profile-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <span className="hint">At least 8 characters.</span>
          </Field>
          <Field label="Confirm new password" htmlFor="profile-confirm-password">
            <input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </Field>
        </div>
        <StatusMessage status={passwordStatus} />
        <div className="form-actions">
          <button type="submit" disabled={saving}>Change password</button>
        </div>
      </form>
    </div>
  )
}

// Reads a JSON response. A 401 means the login ended, so hand off to onLogout and return null
function useApiResponse(onLogout: () => void) {
  return useCallback(async (response: Response) => {
    if (response.status === 401) {
      onLogout()
      return null
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }, [onLogout])
}

type AnimalListRow = {
  id: number
  name: string
  species: string
  sex: string
  birth_date: string | null
  age: number | null
  location: string | null
}

function AnimalManagementPage({ token, canEdit, onLogout }: { token: string; canEdit: boolean; onLogout: () => void }) {
  const [animals, setAnimals] = useState<AnimalListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const emptyForm: AnimalFormValues = { name: '', species: '', sex: '', birth_date: '', location: '' }
  const [form, setForm] = useState<AnimalFormValues>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<AnimalFormValues>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleApiResponse = useApiResponse(onLogout)

  // Sort animals based on current sort field and direction; empty values sort as blank text
  const sortValue = (animal: AnimalListRow) => {
    const value = (animal as Record<string, unknown>)[sortField]
    return value === null || value === undefined ? '' : String(value).toLowerCase()
  }
  const sortedAnimals = [...animals].sort((a, b) => {
    const aValue = sortValue(a)
    const bValue = sortValue(b)
    return sortDirection === 'asc'
      ? aValue.localeCompare(bValue, undefined, { numeric: true })
      : bValue.localeCompare(aValue, undefined, { numeric: true })
  })

  // Handle column header click for sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Get sort indicator for column headers
  const getSortIndicator = (field: string) => {
    if (sortField !== field) return '↕'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  // Fetch animals from backend
  useEffect(() => {
    setLoading(true)
    fetch(`${apiUrl}/animals/`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setAnimals(data)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load animals')
        setLoading(false)
      })
  }, [submitting, token, handleApiResponse])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value })
  }

  const startEdit = (animal: { id: number; name: string; species: string; sex: string; birth_date: string | null; location: string | null }) => {
    setError(null)
    setEditingId(animal.id)
    setEditForm({
      name: animal.name,
      species: animal.species,
      sex: animal.sex,
      birth_date: animal.birth_date ?? '',
      location: animal.location ?? '',
    })
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    fetch(`${apiUrl}/animals/${editingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...editForm,
        birth_date: editForm.birth_date || null,
      }),
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setEditingId(null)
        }
        setSubmitting(false)
      })
      .catch(() => {
        setError('Failed to update animal')
        setSubmitting(false)
      })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    fetch(`${apiUrl}/animals/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...form,
        birth_date: form.birth_date || null,
      }),
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setForm(emptyForm)
        }
        setSubmitting(false)
      })
      .catch(() => {
        setError('Failed to add animal')
        setSubmitting(false)
      })
  }

  return (
    <div className="page">
      <PageHeader
        title="Animals"
        subtitle={canEdit ? 'Add and manage the animals in your organization.' : 'The animals in your organization.'}
      />
      {canEdit && (
        <form className="card" onSubmit={handleSubmit}>
          <h3 className="card-title">Add animal</h3>
          <AnimalFields values={form} onChange={handleChange} idPrefix="add" />
          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>Add animal</button>
          </div>
        </form>
      )}
      {canEdit && editingId !== null && (
        <form className="card" onSubmit={handleEditSubmit}>
          <h3 className="card-title">Edit animal</h3>
          <AnimalFields values={editForm} onChange={handleEditChange} idPrefix="edit" />
          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>Save changes</button>
            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}
      {error && <div className="error">{error}</div>}
      <h2 className="section-title">{animals.length > 0 ? `All animals (${animals.length})` : 'All animals'}</h2>
      {loading ? (
        <div className="empty">Loading animals...</div>
      ) : animals.length === 0 ? (
        <div className="card empty">No animals yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('name')}>Name {getSortIndicator('name')}</th>
                <th className="sortable" onClick={() => handleSort('species')}>Species {getSortIndicator('species')}</th>
                <th className="sortable" onClick={() => handleSort('sex')}>Sex {getSortIndicator('sex')}</th>
                <th className="sortable" onClick={() => handleSort('age')}>Age {getSortIndicator('age')}</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {groupAnimalsByLocation(sortedAnimals, () => 0).map(group => (
                <React.Fragment key={group.key}>
                  <tr className="group-row">
                    <td colSpan={canEdit ? 5 : 4}>{group.label} ({group.animals.length})</td>
                  </tr>
                  {group.animals.map(animal => (
                    <tr key={animal.id}>
                      <td><strong>{animal.name}</strong></td>
                      <td>{animal.species}</td>
                      <td>{animal.sex}</td>
                      <td>{animal.age === null || animal.age === undefined ? '' : animal.age < 1 ? '<1' : animal.age}</td>
                      {canEdit && <td><button className="small" onClick={() => startEdit(animal)}>Edit</button></td>}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TrainingPlanPage({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    animal_id: '',
    name: '',
    cue_description: '',
    criteria: '',
    category: '',
    started_date: '',
  })
  const [steps, setSteps] = useState([
    { id: 1, description: '', estimated_sessions: 5 }
  ])

  const handleApiResponse = useApiResponse(onLogout)

  // Fetch animals from backend
  useEffect(() => {
    setLoading(true)
    fetch(`${apiUrl}/animals/`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setAnimals(data)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load animals')
        setLoading(false)
      })
  }, [token, handleApiResponse])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleStepChange = (stepId: number, field: string, value: string | number) => {
    setSteps(steps.map(step => 
      step.id === stepId ? { ...step, [field]: value } : step
    ))
  }

  const addStep = () => {
    const newId = Math.max(...steps.map(s => s.id)) + 1
    setSteps([...steps, { id: newId, description: '', estimated_sessions: 5 }])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    // Create plan with actual steps data
    const planData = {
      name: form.name,
      cue_description: form.cue_description,
      criteria: form.criteria,
      category: form.category,
      started_date: form.started_date || null,
      steps: steps.map((step, index) => ({
        name: `Step ${index + 1}`,
        description: step.description,
        order: index + 1,
        estimated_sessions: step.estimated_sessions,
        is_complete: false
      }))
    }

    fetch(`${apiUrl}/plans/animal/${form.animal_id}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(planData),
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setForm({ animal_id: '', name: '', cue_description: '', criteria: '', category: '', started_date: '' })
          setSteps([{ id: 1, description: '', estimated_sessions: 5 }])
          alert('Training plan created successfully!')
        }
        setSubmitting(false)
      })
      .catch(() => {
        setError('Failed to create training plan')
        setSubmitting(false)
      })
  }

  return (
    <div className="page medium">
      <PageHeader title="New training plan" subtitle="Describe the behavior, then break it into steps." />
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="empty">Loading animals...</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="card">
            <h3 className="card-title">Plan details</h3>
            <div className="form-grid">
              <Field label="Animal" htmlFor="plan-animal">
                <select id="plan-animal" name="animal_id" value={form.animal_id} onChange={handleChange} required>
                  <option value="" disabled>Select animal</option>
                  {groupAnimalsByLocation(animals).map(group => (
                    <optgroup key={group.key} label={group.label}>
                      {group.animals.map(animal => (
                        <option key={animal.id} value={animal.id}>
                          {animal.name} ({animal.species})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Plan name" htmlFor="plan-name">
                <input id="plan-name" name="name" value={form.name} onChange={handleChange} required />
              </Field>
              <Field label="Category" htmlFor="plan-category">
                <select id="plan-category" name="category" value={form.category} onChange={handleChange} required>
                  <option value="" disabled>Select category</option>
                  <option value="Husbandry">Husbandry</option>
                  <option value="Aerial">Aerial</option>
                  <option value="Conceptual">Conceptual</option>
                  <option value="Stationary">Stationary</option>
                  <option value="Vocal">Vocal</option>
                  <option value="Interaction">Interaction</option>
                </select>
              </Field>
              <Field label="Start date" htmlFor="plan-started">
                <input id="plan-started" name="started_date" type="date" value={form.started_date} onChange={handleChange} />
              </Field>
            </div>
            <div className="stack mt">
              <Field label="Cue" htmlFor="plan-cue">
                <textarea
                  id="plan-cue"
                  name="cue_description"
                  placeholder="The signal used to start this behavior, e.g. a hand signal, verbal command or whistle"
                  value={form.cue_description}
                  onChange={handleChange}
                  required
                />
              </Field>
              <Field label="Success criteria" htmlFor="plan-criteria">
                <textarea
                  id="plan-criteria"
                  name="criteria"
                  placeholder="What exactly the animal must do for the behavior to count as correct"
                  value={form.criteria}
                  onChange={handleChange}
                  required
                />
              </Field>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Training steps</h3>
            {steps.map((step, index) => (
              <div className="step-card" key={step.id}>
                <span className="step-number">{index + 1}</span>
                <Field label="Description" htmlFor={`step-description-${step.id}`}>
                  <textarea
                    id={`step-description-${step.id}`}
                    placeholder="Describe this training step"
                    value={step.description}
                    onChange={(e) => handleStepChange(step.id, 'description', e.target.value)}
                    required
                  />
                </Field>
                <Field label="Estimated sessions" htmlFor={`step-sessions-${step.id}`}>
                  <select
                    id={`step-sessions-${step.id}`}
                    value={step.estimated_sessions}
                    onChange={(e) => handleStepChange(step.id, 'estimated_sessions', parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(num => (
                      <option key={num} value={num}>{num} session{num !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>
            ))}
            <button type="button" className="mt" onClick={addStep}>+ Add step</button>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Creating plan...' : 'Create training plan'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const NO_LOCATION = 'No location'

function groupAnimalsByLocation<T extends { name: string; location?: string | null }>(
  animals: T[],
  compare: (a: T, b: T) => number = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
) {
  const groups = new Map<string, { key: string; label: string; animals: T[] }>()
  for (const animal of animals) {
    const label = animal.location?.trim() || NO_LOCATION
    // Locations are free text, so "lagoon a" and "Lagoon A " count as the same place
    const key = label.toLowerCase()
    const group = groups.get(key) ?? { key, label, animals: [] }
    group.animals.push(animal)
    groups.set(key, group)
  }
  const numeric = { numeric: true }
  return [...groups.values()]
    .map(group => ({ ...group, animals: [...group.animals].sort(compare) }))
    .sort((a, b) => {
      if (a.label === NO_LOCATION) return 1
      if (b.label === NO_LOCATION) return -1
      return a.label.localeCompare(b.label, undefined, numeric)
    })
}

interface PlanStep {
  id: number
  name: string
  description: string | null
  order: number
  estimated_sessions: number | null
  is_complete: boolean
}

interface SessionNote {
  id: number
  note: string | null
  performed_date: string | null
  performed_time: string | null
  timestamp: string
}

interface PlanSummary {
  id: number
  name: string
  created_by_id: number | null
  created_by_name: string | null
}

interface AnimalRow {
  id: number
  name: string
  species: string
  location?: string | null
}

type StepStatus = 'complete' | 'progress' | 'idle'
type NotesByStepId = { [stepId: number]: SessionNote[] }

const STEP_STATUS_LABEL: Record<StepStatus, string> = { complete: 'Complete', progress: 'In progress', idle: 'Not started' }
const DAY_WIDTH = 20

const stepStatus = (step: PlanStep, noteCount: number): StepStatus =>
  step.is_complete ? 'complete' : noteCount > 0 ? 'progress' : 'idle'

// Steps are created as "Step 1", "Step 2"..., so the description is the real title; a step someone renamed keeps its name
const stepText = (step: PlanStep) => {
  const isDefaultName = /^step \d+$/i.test(step.name.trim())
  return isDefaultName
    ? { title: step.description || step.name, subtitle: null }
    : { title: step.name, subtitle: step.description }
}

// Sessions are dated by the day they were performed; days are counted as whole days since 1970 so date math has no time zone or DST surprises
const noteDay = (note: SessionNote) => note.performed_date ?? new Date(note.timestamp + 'Z').toLocaleDateString('en-CA')
const dayNumber = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date) / 86400000
}
const todayDayNumber = () => dayNumber(new Date().toLocaleDateString('en-CA'))

// Times are "HH:MM" (the API sends "HH:MM:SS"); sessions logged before times existed have none
const noteTime = (note: SessionNote) => note.performed_time?.slice(0, 5) ?? null
const nowTime = () => new Date().toTimeString().slice(0, 5)
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
// An old session with no time starts its edit form at the time of day it was entered, which is the closest record
const timeForEditing = (note: SessionNote) => noteTime(note) ?? new Date(note.timestamp + 'Z').toTimeString().slice(0, 5)
const formatSessionWhen = (note: SessionNote) => {
  const time = noteTime(note)
  return time ? `${formatNoteDate(note)} · ${formatTime(time)}` : formatNoteDate(note)
}
const formatDayNumber = (day: number, options: Intl.DateTimeFormatOptions) =>
  new Date(day * 86400000).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' })

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6.5l2.3 2.3 4.7-5" />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? 'M3 9l4-4 4 4' : 'M3 5l4 4 4-4'} />
    </svg>
  )
}

function StepNumber({ status, n }: { status: StepStatus; n: number }) {
  return <span className={'step-num ' + status}>{status === 'complete' ? <CheckIcon /> : n}</span>
}

function StatusPill({ status }: { status: StepStatus }) {
  return <span className={'pill ' + status}>{STEP_STATUS_LABEL[status]}</span>
}

function ProgressMeter({ planned, logged, status }: { planned: number; logged: number; status: StepStatus }) {
  const slots = Math.max(planned, logged)
  return (
    <span className="meter" aria-hidden="true">
      {Array.from({ length: slots }, (_, i) => <i key={i} className={i < logged ? 'on ' + status : ''} />)}
    </span>
  )
}

function PlanTimeline({ steps, notesByStepId, activeDotKey, onActiveDotChange, onOpenStep }: {
  steps: PlanStep[]
  notesByStepId: NotesByStepId
  activeDotKey: string | null
  onActiveDotChange: (key: string | null) => void
  onOpenStep: (stepId: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll only when needed: keep the latest session and today in view, favoring the latest session on narrow screens
  useEffect(() => {
    const container = scrollRef.current
    const todayLine = container?.querySelector<HTMLElement>('.today-line')
    if (!container || !todayLine) return
    const labelWidth = container.querySelector<HTMLElement>('.cal-label')?.offsetWidth ?? 0
    const contentX = (el: Element) => el.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft
    const latestDot = [...container.querySelectorAll<HTMLElement>('.cal-dot')]
      .reduce<HTMLElement | null>((best, dot) => (!best || Number(dot.dataset.day) > Number(best.dataset.day) ? dot : best), null)
    const anchor = latestDot ?? todayLine
    const inView = (x: number) => x >= container.scrollLeft + labelWidth + 16 && x <= container.scrollLeft + container.clientWidth - 16
    if (inView(contentX(anchor)) && inView(contentX(todayLine))) return
    container.scrollLeft = Math.max(0, contentX(anchor) - labelWidth - 40)
  }, [])

  const today = todayDayNumber()
  // One dot per day per step: every session from that day sits behind the same dot, in time order
  const stepDays = steps.map(step => {
    const byDay = new Map<number, SessionNote[]>()
    for (const note of notesByStepId[step.id] ?? []) {
      const day = dayNumber(noteDay(note))
      byDay.set(day, [...(byDay.get(day) ?? []), note])
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([day, notes]) => ({ day, notes }))
  })
  const allDays = stepDays.flat().map(group => group.day)
  const mondayOf = (day: number) => day - ((day + 3) % 7) // day 0 (1970-01-01) was a Thursday
  const start = mondayOf(Math.min(today, ...allDays))
  const totalDays = Math.max(Math.ceil((Math.max(today, ...allDays) - start + 1) / 7) * 7, 42)
  const leftOf = (day: number) => (day - start) * DAY_WIDTH + DAY_WIDTH / 2

  const weeks = Array.from({ length: totalDays / 7 }, (_, week) => start + week * 7)
  const months: { key: string; left: number; width: number; long: string; short: string }[] = []
  for (let i = 0; i < totalDays; i++) {
    const key = formatDayNumber(start + i, { year: 'numeric', month: 'numeric' })
    const previous = months[months.length - 1]
    if (previous && previous.key === key) {
      previous.width += DAY_WIDTH
    } else {
      months.push({
        key,
        left: i * DAY_WIDTH,
        width: DAY_WIDTH,
        long: formatDayNumber(start + i, { month: 'long', year: 'numeric' }),
        short: formatDayNumber(start + i, { month: 'short' }),
      })
    }
  }

  return (
    <div>
      <div className="chart-legend">
        <span><i className="k sess" />Session</span>
        <span><i className="k done" />Complete</span>
        <span><i className="k on" />In progress</span>
        <span><i className="k today" />Today</span>
      </div>
      <div className="cal-scroll" ref={scrollRef}>
        <div className={'cal' + (activeDotKey !== null ? ' has-pop' : '')} style={{ '--day': `${DAY_WIDTH}px`, '--days': totalDays } as React.CSSProperties}>
          <div className="cal-corner" />
          <div className="cal-scale">
            <div className="cal-months">
              {months.map(month => (
                <span key={month.left} style={{ left: month.left, width: month.width }}>
                  {month.width >= 110 ? month.long : month.width >= 40 ? month.short : ''}
                </span>
              ))}
            </div>
            <div className="cal-weeks">
              {weeks.map(week => (
                <span key={week} style={{ left: (week - start) * DAY_WIDTH, width: 7 * DAY_WIDTH }}>
                  {formatDayNumber(week, { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          </div>
          {steps.map((step, idx) => {
            const groups = stepDays[idx]
            const sessionCount = groups.reduce((sum, group) => sum + group.notes.length, 0)
            const status = stepStatus(step, sessionCount)
            const days = groups.map(group => group.day)
            const firstDay = Math.min(...days)
            const lastDay = Math.max(...days)
            const daysSince = status === 'progress' ? today - lastDay : 0
            const { title } = stepText(step)
            return (
              <React.Fragment key={step.id}>
                <div className="cal-label">
                  <StepNumber status={status} n={idx + 1} />
                  <button className="cal-label-button" onClick={() => onOpenStep(step.id)} title="Open in list">
                    <span className="cal-label-title">{title}</span>
                    <span className="muted cal-label-sub">{sessionCount} of {step.estimated_sessions ?? 0} sessions</span>
                  </button>
                </div>
                <div className="cal-lane">
                  <div className="weekends">
                    {Array.from({ length: totalDays }, (_, i) => i)
                      .filter(i => (start + i + 3) % 7 >= 5)
                      .map(i => <b key={i} style={{ left: i * DAY_WIDTH }} />)}
                  </div>
                  <div className="today-line" style={{ left: leftOf(today) }}>{idx === 0 && <em>Today</em>}</div>
                  {groups.length > 0
                    ? <div className={'cal-span ' + status} style={{ left: leftOf(firstDay), width: (lastDay - firstDay) * DAY_WIDTH }} />
                    : <div className="cal-empty" />}
                  {groups.map(({ day, notes }) => {
                    const key = `${step.id}-${day}`
                    const many = notes.length > 1
                    return (
                      <React.Fragment key={key}>
                        <button
                          className={'cal-dot ' + status}
                          style={{ left: leftOf(day) }}
                          data-day={day}
                          aria-label={`${many ? `${notes.length} sessions` : 'Session'} on ${formatNoteDate(notes[0])}`}
                          onClick={e => {
                            e.stopPropagation()
                            onActiveDotChange(activeDotKey === key ? null : key)
                          }}
                        >
                          {many ? notes.length : null}
                        </button>
                        {activeDotKey === key && (
                          <div className="popover cal-popover" style={{ left: leftOf(day) }} onClick={e => e.stopPropagation()}>
                            <div className="popover-title">
                              {formatNoteDate(notes[0])}
                              {many && <span className="muted"> · {notes.length} sessions</span>}
                            </div>
                            <ul className="pop-sessions">
                              {notes.map(note => (
                                <li key={note.id}>
                                  {noteTime(note) && <b>{formatTime(noteTime(note) as string)}</b>}
                                  {note.note ? <span>{note.note}</span> : <span className="muted">No note</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                  {daysSince >= 3 && (
                    <div className="cal-gap" style={{ left: leftOf(lastDay) + 12, width: (today - lastDay) * DAY_WIDTH - 24 }}>
                      <span>{daysSince} days since last session</span>
                    </div>
                  )}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PlanDetail({ token, plan, steps, notesByStepId, stepsLoading, canEdit, onStepsChange, onNotesChange, onLogout }: {
  token: string
  plan: PlanSummary
  steps: PlanStep[]
  notesByStepId: NotesByStepId
  stepsLoading: boolean
  canEdit: boolean
  onStepsChange: (update: (previous: PlanStep[]) => PlanStep[]) => void
  onNotesChange: (stepId: number, notes: SessionNote[]) => void
  onLogout: () => void
}) {
  const [view, setView] = useState<'list' | 'timeline'>('list')
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null)
  const [stepMode, setStepMode] = useState<'view' | 'edit' | 'add'>('view')
  const [stepForm, setStepForm] = useState({ name: '', description: '', estimated_sessions: '' })
  const [sessionForm, setSessionForm] = useState({ note: '', performed_date: '', performed_time: '', markComplete: false })
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteForm, setNoteForm] = useState({ note: '', performed_date: '', performed_time: '' })
  const [activeDotKey, setActiveDotKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Timeline popovers close on any click outside them
  useEffect(() => {
    const close = () => setActiveDotKey(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })
    if (response.status === 401) {
      onLogout()
      throw new Error('Session expired')
    }
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response
  }

  const reloadNotes = async (stepId: number) => {
    const response = await request(`/steps/${stepId}/notes`)
    onNotesChange(stepId, await response.json())
  }

  const run = async (e: React.FormEvent, failure: string, action: () => Promise<void>) => {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    try {
      await action()
    } catch {
      setFormError(failure)
    } finally {
      setBusy(false)
    }
  }

  const toggleStep = (stepId: number) => {
    setExpandedStepId(previous => (previous === stepId ? null : stepId))
    setStepMode('view')
    setEditingNoteId(null)
    setFormError(null)
  }

  const openStepInList = (stepId: number) => {
    setView('list')
    setExpandedStepId(stepId)
    setStepMode('view')
    setEditingNoteId(null)
    setFormError(null)
  }

  const startEditStep = (step: PlanStep) => {
    setFormError(null)
    setStepForm({ name: step.name, description: step.description ?? '', estimated_sessions: String(step.estimated_sessions ?? '') })
    setStepMode('edit')
  }

  const saveStep = (e: React.FormEvent, step: PlanStep) => run(e, 'Failed to update step.', async () => {
    const response = await request(`/steps/${step.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: stepForm.name, description: stepForm.description, estimated_sessions: Number(stepForm.estimated_sessions) }),
    })
    const updated = await response.json()
    onStepsChange(previous => previous.map(s => (s.id === step.id ? { ...s, ...updated } : s)))
    setStepMode('view')
  })

  const startAddSession = () => {
    setFormError(null)
    setSessionForm({ note: '', performed_date: new Date().toLocaleDateString('en-CA'), performed_time: nowTime(), markComplete: false })
    setStepMode('add')
  }

  const saveSession = (e: React.FormEvent, step: PlanStep) => run(e, 'Failed to add session.', async () => {
    await request(`/steps/${step.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        note: sessionForm.note,
        performed_date: sessionForm.performed_date || new Date().toLocaleDateString('en-CA'),
        performed_time: sessionForm.performed_time || null,
      }),
    })
    await reloadNotes(step.id)
    setStepMode('view')
    if (sessionForm.markComplete && !step.is_complete) {
      try {
        await request(`/steps/${step.id}/complete`, { method: 'POST' })
        onStepsChange(previous => previous.map(s => (s.id === step.id ? { ...s, is_complete: true } : s)))
      } catch {
        setFormError('Session added, but the step could not be marked complete.')
      }
    }
  })

  const startEditNote = (note: SessionNote) => {
    setFormError(null)
    setNoteForm({ note: note.note ?? '', performed_date: noteDay(note), performed_time: timeForEditing(note) })
    setEditingNoteId(note.id)
  }

  const saveNote = (e: React.FormEvent, note: SessionNote, stepId: number) => run(e, 'Failed to save session.', async () => {
    await request(`/steps/notes/${note.id}`, { method: 'PUT', body: JSON.stringify({ ...noteForm, performed_time: noteForm.performed_time || null }) })
    // Refetch so a changed date or time moves the session to its new place in the order
    await reloadNotes(stepId)
    setEditingNoteId(null)
  })

  const noteCounts = steps.map(step => (notesByStepId[step.id] ?? []).length)
  const logged = noteCounts.reduce((sum, count) => sum + count, 0)
  const planned = steps.reduce((sum, step) => sum + (step.estimated_sessions ?? 0), 0)
  const completeCount = steps.filter(step => step.is_complete).length
  const percent = planned > 0 ? Math.min(100, Math.round((logged / planned) * 100)) : 0

  return (
    <section className="card mt">
      <div className="plan-top">
        <div className="plan-heading">
          <h2>{plan.name}</h2>
          {plan.created_by_name && <span className="muted">Created by {plan.created_by_name}</span>}
        </div>
        <div className="plan-summary">
          <div className="stat"><b>{percent}%</b><span>overall</span></div>
          <div className="stat"><b>{logged}</b><span>of {planned} sessions</span></div>
          <div className="stat"><b>{completeCount}</b><span>of {steps.length} steps complete</span></div>
          <div className="view-switch" role="group" aria-label="Plan view">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
            <button aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>Timeline</button>
          </div>
        </div>
      </div>

      {stepsLoading ? (
        <div className="empty">Loading steps...</div>
      ) : steps.length === 0 ? (
        <div className="empty">No steps for this plan.</div>
      ) : view === 'timeline' ? (
        <PlanTimeline
          steps={steps}
          notesByStepId={notesByStepId}
          activeDotKey={activeDotKey}
          onActiveDotChange={setActiveDotKey}
          onOpenStep={openStepInList}
        />
      ) : (
        <div className="plan-rows">
          <div className="step-head">
            <span />
            <span>Step</span>
            <span className="c-status">Status</span>
            <span className="c-prog">Progress</span>
            <span className="c-last">Last session</span>
            <span />
          </div>
          {steps.map((step, idx) => {
            const notes = notesByStepId[step.id] ?? []
            const status = stepStatus(step, notes.length)
            const open = expandedStepId === step.id
            const { title, subtitle } = stepText(step)
            const plannedForStep = step.estimated_sessions ?? 0
            return (
              <div className={'step-item' + (open ? ' open' : '')} key={step.id}>
                <button className="step-row" aria-expanded={open} onClick={() => toggleStep(step.id)}>
                  <span className="c-num"><StepNumber status={status} n={idx + 1} /></span>
                  <span className="c-name">
                    <span className="step-name">{title}</span>
                    {subtitle && <span className="step-desc">{subtitle}</span>}
                  </span>
                  <span className="c-status"><StatusPill status={status} /></span>
                  <span className="c-prog">
                    <ProgressMeter planned={plannedForStep} logged={notes.length} status={status} />
                    <small>{notes.length} / {plannedForStep}</small>
                  </span>
                  <span className="c-last">{notes.length > 0 ? formatNoteDate(notes[notes.length - 1]) : '—'}</span>
                  <span className="c-chev"><Chevron open={open} /></span>
                </button>
                {open && (
                  <div className="step-panel">
                    {step.description && <p className="step-full-desc">{step.description}</p>}
                    {formError && <div className="error">{formError}</div>}
                    {stepMode === 'edit' ? (
                      <form className="panel-form" onSubmit={e => saveStep(e, step)}>
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input type="text" value={stepForm.name} onChange={e => setStepForm(f => ({ ...f, name: e.target.value }))} required />
                        </label>
                        <label className="field">
                          <span className="field-label">Description</span>
                          <textarea rows={3} value={stepForm.description} onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))} />
                        </label>
                        <label className="field">
                          <span className="field-label">Estimated sessions</span>
                          <input type="number" min={1} value={stepForm.estimated_sessions} onChange={e => setStepForm(f => ({ ...f, estimated_sessions: e.target.value }))} required />
                        </label>
                        <div className="row">
                          <button type="submit" className="primary small" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                          <button type="button" className="small" onClick={() => { setStepMode('view'); setFormError(null) }}>Cancel</button>
                        </div>
                      </form>
                    ) : stepMode === 'add' ? (
                      <form className="panel-form" onSubmit={e => saveSession(e, step)}>
                        <div className="two-col">
                          <label className="field">
                            <span className="field-label">Performed date</span>
                            <input type="date" value={sessionForm.performed_date} onChange={e => setSessionForm(f => ({ ...f, performed_date: e.target.value }))} required />
                          </label>
                          <label className="field">
                            <span className="field-label">Time</span>
                            <input type="time" value={sessionForm.performed_time} onChange={e => setSessionForm(f => ({ ...f, performed_time: e.target.value }))} required />
                          </label>
                        </div>
                        <label className="field">
                          <span className="field-label">Session note</span>
                          <textarea rows={3} value={sessionForm.note} onChange={e => setSessionForm(f => ({ ...f, note: e.target.value }))} />
                        </label>
                        {!step.is_complete && (
                          <label className="checkbox">
                            <input type="checkbox" checked={sessionForm.markComplete} onChange={e => setSessionForm(f => ({ ...f, markComplete: e.target.checked }))} />
                            Mark step as complete
                          </label>
                        )}
                        <div className="row">
                          <button type="submit" className="primary small" disabled={busy}>{busy ? 'Saving...' : 'Add session'}</button>
                          <button type="button" className="small" onClick={() => { setStepMode('view'); setFormError(null) }}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        {notes.length === 0 ? (
                          <p className="muted no-sessions">No sessions logged yet.</p>
                        ) : (
                          <div className="session-log">
                            {notes.map(note => (
                              <div className="log-entry" key={note.id}>
                                <i />
                                <div className="log-body">
                                  {editingNoteId === note.id ? (
                                    <form className="panel-form" onSubmit={e => saveNote(e, note, step.id)}>
                                      <div className="two-col">
                                        <label className="field">
                                          <span className="field-label">Date</span>
                                          <input type="date" value={noteForm.performed_date} onChange={e => setNoteForm(f => ({ ...f, performed_date: e.target.value }))} required />
                                        </label>
                                        <label className="field">
                                          <span className="field-label">Time</span>
                                          <input type="time" value={noteForm.performed_time} onChange={e => setNoteForm(f => ({ ...f, performed_time: e.target.value }))} required />
                                        </label>
                                      </div>
                                      <label className="field">
                                        <span className="field-label">Note</span>
                                        <textarea rows={3} value={noteForm.note} onChange={e => setNoteForm(f => ({ ...f, note: e.target.value }))} />
                                      </label>
                                      <div className="row">
                                        <button type="submit" className="primary small" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                                        <button type="button" className="small" onClick={() => { setEditingNoteId(null); setFormError(null) }}>Cancel</button>
                                      </div>
                                    </form>
                                  ) : (
                                    <>
                                      <div className="log-head">
                                        <span className="log-date">{formatSessionWhen(note)}</span>
                                        {canEdit && <button className="ghost small" onClick={() => startEditNote(note)}>Edit</button>}
                                      </div>
                                      {note.note && <p className="log-note">{note.note}</p>}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {canEdit && (
                          <div className="row">
                            <button className="primary small" onClick={startAddSession}>Add session</button>
                            <button className="small" onClick={() => startEditStep(step)}>Edit step</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function TrainingPlansListPage({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [animals, setAnimals] = useState<AnimalRow[]>([])
  const [expandedAnimalId, setExpandedAnimalId] = useState<number | null>(null)
  const [plansByAnimal, setPlansByAnimal] = useState<{ [animalId: number]: PlanSummary[] }>({})
  const [selectedPlan, setSelectedPlan] = useState<PlanSummary | null>(null)
  const [steps, setSteps] = useState<PlanStep[]>([])
  const [stepsLoading, setStepsLoading] = useState(false)
  const [notesByStepId, setNotesByStepId] = useState<NotesByStepId>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const latestPlanRequest = useRef(0)

  const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }

  const handleApiResponse = useApiResponse(onLogout)

  useEffect(() => {
    setLoading(true)
    fetch(`${apiUrl}/animals/`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setAnimals(data)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load animals')
        setLoading(false)
      })
  }, [token, handleApiResponse])

  const fetchPlans = (animalId: number) => {
    if (plansByAnimal[animalId]) return // already loaded
    fetch(`${apiUrl}/plans/animal/${animalId}`, { headers: authHeaders })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setPlansByAnimal(prev => ({ ...prev, [animalId]: data }))
        }
      })
      .catch(() => {
        setError('Failed to load training plans')
      })
  }

  const fetchSteps = (planId: number) => {
    const request = ++latestPlanRequest.current
    setStepsLoading(true)
    fetch(`${apiUrl}/plans/${planId}`, { headers: authHeaders })
      .then(handleApiResponse)
      .then(plan => {
        if (request !== latestPlanRequest.current) return // a newer plan was picked meanwhile
        if (plan !== null && plan.steps) {
          setSteps(plan.steps)
          plan.steps.forEach((step: PlanStep) => {
            fetch(`${apiUrl}/steps/${step.id}/notes`, { headers: authHeaders })
              .then(res => (res.ok ? res.json() : []))
              .then(notes => {
                setNotesByStepId(prev => ({ ...prev, [step.id]: notes }))
              })
          })
        } else {
          setSteps([])
        }
      })
      .catch(() => {
        setError('Failed to load plan steps')
      })
      .finally(() => {
        if (request === latestPlanRequest.current) setStepsLoading(false)
      })
  }

  const handleAnimalClick = (animalId: number) => {
    setExpandedAnimalId(expandedAnimalId === animalId ? null : animalId)
    if (!plansByAnimal[animalId]) {
      fetchPlans(animalId)
    }
    latestPlanRequest.current++
    setSelectedPlan(null)
    setSteps([])
    setStepsLoading(false)
    setNotesByStepId({})
  }

  const handlePlanClick = (plan: PlanSummary) => {
    setSelectedPlan(plan)
    setSteps([])
    fetchSteps(plan.id)
  }

  return (
    <div className="page">
      <PageHeader title="Training plans" subtitle="Pick an animal, then a plan, to see its steps and log sessions." />
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="empty">Loading animals...</div>
      ) : animals.length === 0 ? (
        <div className="card empty">No animals yet.</div>
      ) : (
        <div>
          {groupAnimalsByLocation(animals).map(group => (
            <section className="location-group" key={group.key}>
              <h2 className="location-heading">{group.label} ({group.animals.length})</h2>
              {group.animals.map(animal => (
                <div className="animal-group" key={animal.id}>
                  <button
                    className={'animal-toggle' + (expandedAnimalId === animal.id ? ' open' : '')}
                    onClick={() => handleAnimalClick(animal.id)}
                  >
                    <span>{animal.name} <span className="muted">({animal.species})</span></span>
                    <span className="chevron">&rsaquo;</span>
                  </button>
                  {expandedAnimalId === animal.id && plansByAnimal[animal.id] && (
                    plansByAnimal[animal.id].length === 0 ? (
                      <div className="muted plan-list">No training plans for this animal.</div>
                    ) : (
                      <div className="plan-list">
                        {plansByAnimal[animal.id].map(plan => (
                          <button
                            key={plan.id}
                            className={'plan-chip' + (selectedPlan && selectedPlan.id === plan.id ? ' selected' : '')}
                            onClick={() => handlePlanClick(plan)}
                          >
                            {plan.name}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      {selectedPlan && (
        <PlanDetail
          key={selectedPlan.id}
          token={token}
          plan={selectedPlan}
          steps={steps}
          notesByStepId={notesByStepId}
          stepsLoading={stepsLoading}
          canEdit={selectedPlan.created_by_id === user.id || canManageTeam(user)}
          onStepsChange={setSteps}
          onNotesChange={(stepId, notes) => setNotesByStepId(prev => ({ ...prev, [stepId]: notes }))}
          onLogout={onLogout}
        />
      )}
    </div>
  )
}

interface Member {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  role: Role
  status: string
}

function TeamPage({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [requests, setRequests] = useState<Member[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [requestRoles, setRequestRoles] = useState<{ [userId: number]: Role }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isCurator = user.role === 'curator'
  const assignableRoles: Role[] = isCurator ? ['trainer', 'supervisor', 'curator'] : ['trainer', 'supervisor']

  const authFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    })
    if (response.status === 401) {
      onLogout()
      return null
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.detail || `HTTP error! status: ${response.status}`)
    }
    return response.status === 204 ? true : response.json()
  }, [token, onLogout])

  const load = useCallback(async () => {
    try {
      const [pending, active] = await Promise.all([authFetch('/team/requests'), authFetch('/team/members')])
      if (pending !== null && active !== null) {
        setRequests(pending)
        setMembers(active)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => {
    load()
  }, [load])

  const act = async (path: string, options: RequestInit) => {
    setError(null)
    try {
      await authFetch(path, options)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return (
    <div className="page">
      <PageHeader title="Team" subtitle="Approve people who want to join your organization and see who has access." />
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="empty">Loading team...</div>
      ) : (
        <>
          <h2 className="section-title">Join requests</h2>
          {requests.length === 0 ? (
            <div className="card empty">No pending requests.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Person</th><th>Role to assign</th><th></th></tr>
                </thead>
                <tbody>
                  {requests.map(request => (
                    <tr key={request.id}>
                      <td>{nameWithEmail(request)}</td>
                      <td>
                        <select
                          value={requestRoles[request.id] ?? 'trainer'}
                          onChange={e => setRequestRoles(prev => ({ ...prev, [request.id]: e.target.value as Role }))}
                        >
                          {assignableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="row">
                          <button
                            className="primary small"
                            onClick={() => act(`/team/requests/${request.id}/approve`, {
                              method: 'POST',
                              body: JSON.stringify({ role: requestRoles[request.id] ?? 'trainer' }),
                            })}
                          >Approve</button>
                          <button
                            className="danger small"
                            onClick={() => act(`/team/requests/${request.id}`, { method: 'DELETE' })}
                          >Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="section-title">Members ({members.length})</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Member</th><th>Role</th></tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id}>
                    <td>{nameWithEmail(member)}</td>
                    <td>
                      {isCurator ? (
                        <select
                          value={member.role}
                          onChange={e => act(`/team/members/${member.id}/role`, {
                            method: 'PUT',
                            body: JSON.stringify({ role: e.target.value }),
                          })}
                        >
                          {assignableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      ) : <span className="badge capitalize">{member.role}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)
  const [userLoadFailed, setUserLoadFailed] = useState(false)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)

  const handleLogin = (newToken: string) => {
    setSessionNotice(null)
    setToken(newToken)
    localStorage.setItem('token', newToken)
  }

  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }, [])

  // The API answers 401 when a login has expired or was ended elsewhere (for example by a password change)
  const expireSession = useCallback(() => {
    handleLogout()
    setSessionNotice('Your session has ended. Please log in again.')
  }, [handleLogout])

  const loadUser = useCallback(() => {
    if (!token) return
    setUserLoadFailed(false)
    fetch(`${apiUrl}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(response => {
        if (response.status === 401) {
          expireSession()
          return null
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        return response.json()
      })
      .then(data => {
        if (data !== null) setUser(data)
      })
      .catch(() => setUserLoadFailed(true))
  }, [token, expireSession])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} notice={sessionNotice} />} />
        <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
        <Route path="*" element={<LoginPage onLogin={handleLogin} notice={sessionNotice} />} />
      </Routes>
    )
  }

  if (userLoadFailed) {
    return (
      <AuthLayout title="Couldn't load your account" subtitle="Check your connection and try again.">
        <div className="row">
          <button className="primary" onClick={loadUser}>Retry</button>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </AuthLayout>
    )
  }

  if (!user) {
    return <div className="auth-wrap"><span className="muted">Loading...</span></div>
  }

  if (user.status === 'pending') {
    return <PendingApprovalPage user={user} onRefresh={loadUser} onLogout={handleLogout} />
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route path="/animals" element={<AnimalManagementPage token={token} canEdit={canManageTeam(user)} onLogout={expireSession} />} />
        <Route path="/profile" element={<ProfilePage token={token} user={user} onUserChange={setUser} onTokenChange={handleLogin} onLogout={expireSession} />} />
        {canManageTeam(user) && <Route path="/team" element={<TeamPage token={token} user={user} onLogout={expireSession} />} />}
        <Route path="/training-plans" element={<TrainingPlanPage token={token} onLogout={expireSession} />} />
        <Route path="/view-plans" element={<TrainingPlansListPage token={token} user={user} onLogout={expireSession} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
