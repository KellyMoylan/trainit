import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import './App.css'
import React from 'react'

interface User {
  id: number
  email: string
}

function LoginPage({ onLogin }: { onLogin: (token: string, user: User) => void }) {
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
      const response = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      
      if (!response.ok) {
        throw new Error('Login failed')
      }
      
      const data = await response.json()
      onLogin(data.access_token, { id: 0, email }) // Backend will return user info
      navigate('/') // Redirect to landing page after successful login
    } catch (err) {
      setError('Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h2>Login to TrainIt!</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      <p>
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </div>
  )
}

function SignupPage({ onLogin }: { onLogin: (token: string, user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
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

    try {
      const response = await fetch('http://localhost:8000/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, organization_name: organizationName }),
      })
      
      if (!response.ok) {
        throw new Error('Signup failed')
      }
      
      const data = await response.json()
      onLogin(data.access_token, data)
      navigate('/') // Redirect to landing page after successful signup
    } catch (err) {
      setError('Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h2>Sign up for TrainIt!</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Organization Name"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
      {error && <div className="error">{error}</div>}
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  )
}

function LandingPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="app-container">
      <h1>Welcome to TrainIt!</h1>
      <p>Your animal training dashboard</p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/animals">
          <button>Manage Animals</button>
        </Link>
        <Link to="/training-plans">
          <button>Create Training Plans</button>
        </Link>
        <Link to="/view-plans">
          <button>View Training Plans</button>
        </Link>
        <button onClick={onLogout} style={{ background: '#e53e3e' }}>Logout</button>
      </div>
    </div>
  )
}

function AnimalManagementPage({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [animals, setAnimals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    species: '',
    sex: '',
    age: '',
    location: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [sortField, setSortField] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Helper function to handle API responses
  const handleApiResponse = async (response: Response) => {
    if (response.status === 401) {
      // Token expired or invalid
      onLogout()
      return null
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  // Sort animals based on current sort field and direction
  const sortedAnimals = [...animals].sort((a, b) => {
    let aValue = a[sortField]
    let bValue = b[sortField]
    
    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = ''
    if (bValue === null || bValue === undefined) bValue = ''
    
    // Convert to string for comparison
    aValue = String(aValue).toLowerCase()
    bValue = String(bValue).toLowerCase()
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue)
    } else {
      return bValue.localeCompare(aValue)
    }
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
    if (sortField !== field) return '↕️'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  // Fetch animals from backend
  useEffect(() => {
    setLoading(true)
    fetch('http://localhost:8000/animals/', {
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
  }, [submitting, token, onLogout])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    fetch('http://localhost:8000/animals/', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...form,
        age: form.age ? parseInt(form.age) : null,
      }),
    })
      .then(handleApiResponse)
      .then(data => {
        if (data !== null) {
          setForm({ name: '', species: '', sex: '', age: '', location: '' })
        }
        setSubmitting(false)
      })
      .catch(() => {
        setError('Failed to add animal')
        setSubmitting(false)
      })
  }

  return (
    <div className="app-container">
      <h2>Animal Management</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <h3>Add Animal</h3>
        <input name="name" placeholder="Animal Name" value={form.name} onChange={handleChange} required />{' '}
        <select name="species" value={form.species} onChange={handleChange} required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
          <option value="" disabled>Select Species</option>
          <option value="Beluga Whale">Beluga Whale</option>
          <option value="Bottle Nose Dolphin">Bottle Nose Dolphin</option>
          <option value="Common Dolphin">Common Dolphin</option>
          <option value="Pacific White-sided Dolphin">Pacific White-sided Dolphin</option>
          <option value="False Killer Whale">False Killer Whale</option>
          <option value="Killer Whale">Killer Whale</option>
          <option value="Black Sea Dolphin">Black Sea Dolphin</option>
          <option value="Manatee">Manatee</option>
          <option value="California Sea Lion">California Sea Lion</option>
          <option value="Sea Otter">Sea Otter</option>
          <option value="Harbor Seal">Harbor Seal</option>
          <option value="Fur Seal">Fur Seal</option>
          <option value="Grey Seal">Grey Seal</option>
          <option value="Northern Elephant Seal">Elephant Seal</option>
          <option value="Walrus">Walrus</option>
        </select>{' '}
        <select name="sex" value={form.sex} onChange={handleChange} required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}>
          <option value="" disabled>Select Sex</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Unknown">Unknown</option>
        </select>{' '}
        <input name="age" placeholder="Age" value={form.age} onChange={handleChange} type="number" min="0" />{' '}
        <input name="location" placeholder="Location" value={form.location} onChange={handleChange} />{' '}
        <button type="submit" disabled={submitting}>Add</button>
      </form>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div>Loading animals...</div>
      ) : (
        <div>
          <h3>Animals</h3>
          {animals.length === 0 ? (
            <div>No animals found.</div>
          ) : (
            <table style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                    Name {getSortIndicator('name')}
                  </th>
                  <th onClick={() => handleSort('species')} style={{ cursor: 'pointer' }}>
                    Species {getSortIndicator('species')}
                  </th>
                  <th onClick={() => handleSort('sex')} style={{ cursor: 'pointer' }}>
                    Sex {getSortIndicator('sex')}
                  </th>
                  <th onClick={() => handleSort('age')} style={{ cursor: 'pointer' }}>
                    Age {getSortIndicator('age')}
                  </th>
                  <th onClick={() => handleSort('location')} style={{ cursor: 'pointer' }}>
                    Location {getSortIndicator('location')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAnimals.map(animal => (
                  <tr key={animal.id}>
                    <td>{animal.name}</td>
                    <td>{animal.species}</td>
                    <td>{animal.sex}</td>
                    <td>{animal.age}</td>
                    <td>{animal.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <Link to="/">
        <button style={{ marginTop: 24 }}>Back to Dashboard</button>
      </Link>
    </div>
  )
}

function TrainingPlanPage({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [animals, setAnimals] = useState<any[]>([])
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

  // Helper function to handle API responses
  const handleApiResponse = async (response: Response) => {
    if (response.status === 401) {
      onLogout()
      return null
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  // Fetch animals from backend
  useEffect(() => {
    setLoading(true)
    fetch('http://localhost:8000/animals/', {
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
  }, [token, onLogout])

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

    fetch(`http://localhost:8000/plans/animal/${form.animal_id}`, {
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
    <div className="app-container" style={{ width: '66vw', maxWidth: 1200 }}>
      <h2>Create Training Plan</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div>Loading animals...</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h3>Plan Details</h3>
          <select 
            name="animal_id" 
            value={form.animal_id} 
            onChange={handleChange} 
            required 
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            <option value="" disabled>Select Animal</option>
            {animals.map(animal => (
              <option key={animal.id} value={animal.id}>
                {animal.name} ({animal.species})
              </option>
            ))}
          </select>
          <br /><br />
          <input 
            name="name" 
            placeholder="Plan Name" 
            value={form.name} 
            onChange={handleChange} 
            required 
          />
          <br /><br />
          <textarea 
            name="cue_description" 
            placeholder="Describe the cue or signal that will be used to initiate this behavior (e.g., hand signal, verbal command, whistle, etc.)" 
            value={form.cue_description} 
            onChange={handleChange} 
            required 
            style={{ 
              width: '100%', 
              padding: '8px 10px', 
              borderRadius: 6, 
              border: '1px solid #cbd5e1', 
              background: '#fff',
              height: '100px',
              resize: 'none'
            }}
          />
          <br /><br />
          <textarea 
            name="criteria" 
            placeholder="Define the specific criteria for success - what exactly does the animal need to do to complete this behavior correctly?" 
            value={form.criteria} 
            onChange={handleChange} 
            required 
            style={{ 
              width: '100%', 
              padding: '8px 10px', 
              borderRadius: 6, 
              border: '1px solid #cbd5e1', 
              background: '#fff',
              height: '100px',
              resize: 'none'
            }}
          />
          <br /><br />
          <select 
            name="category" 
            value={form.category} 
            onChange={handleChange} 
            required 
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            <option value="" disabled>Select Category</option>
            <option value="Husbandry">Husbandry</option>
            <option value="Aerial">Aerial</option>
            <option value="Conceptual">Conceptual</option>
            <option value="Stationary">Stationary</option>
            <option value="Vocal">Vocal</option>
            <option value="Interaction">Interaction</option>
          </select>
          <br /><br />
          <input 
            name="started_date" 
            type="date" 
            value={form.started_date} 
            onChange={handleChange} 
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          />
          <br /><br />
          
          <h3>Training Steps</h3>
          {steps.map((step, index) => (
            <div key={step.id} style={{ 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: 16, 
              marginBottom: 16,
              background: '#f8fafc'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#4a5568' }}>Step {index + 1}</h4>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <textarea
                  placeholder="Describe this training step..."
                  value={step.description}
                  onChange={(e) => handleStepChange(step.id, 'description', e.target.value)}
                  required
                  style={{ 
                    flex: 1,
                    padding: '8px 10px', 
                    borderRadius: 6, 
                    border: '1px solid #cbd5e1', 
                    background: '#fff',
                    height: '80px',
                    resize: 'none'
                  }}
                />
                <select
                  value={step.estimated_sessions}
                  onChange={(e) => handleStepChange(step.id, 'estimated_sessions', parseInt(e.target.value))}
                  style={{ 
                    padding: '8px 10px', 
                    borderRadius: 6, 
                    border: '1px solid #cbd5e1', 
                    background: '#fff',
                    minWidth: '120px'
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(num => (
                    <option key={num} value={num}>{num} session{num !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <button 
            type="button" 
            onClick={addStep}
            style={{ 
              background: '#48bb78', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 8, 
              padding: '8px 16px', 
              cursor: 'pointer',
              marginBottom: 16
            }}
          >
            + Add Another Step
          </button>
          <br />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating Plan...' : 'Create Training Plan'}
          </button>
        </form>
      )}
      <Link to="/">
        <button style={{ marginTop: 24 }}>Back to Dashboard</button>
      </Link>
    </div>
  )
}

function TrainingPlansListPage({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [animals, setAnimals] = useState<any[]>([])
  const [expandedAnimalId, setExpandedAnimalId] = useState<number | null>(null)
  const [plansByAnimal, setPlansByAnimal] = useState<{ [animalId: number]: any[] }>({})
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null)
  const [editingStepIdx, setEditingStepIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // In TrainingPlansListPage, add state for addSessionStepId (number|null) and addSessionForm (object: note, performed_date, markComplete)
  // Pass these and handlers to StepBarWithTooltip
  // In StepBarWithTooltip, render the Add Session button and form using the passed props
  // On submit, call the parent's handler to add the session and refresh notes
  const [addSessionStepId, setAddSessionStepId] = useState<number | null>(null);
  const [addSessionForm, setAddSessionForm] = useState<any>({});
  const [addSessionLoading, setAddSessionLoading] = useState(false);
  const [addSessionError, setAddSessionError] = useState<string | null>(null);
  // In TrainingPlansListPage, add state for sessionNotesByStepId: { [stepId: number]: any[] }
  // After fetching steps for a plan, fetch session notes for each step and store in sessionNotesByStepId
  // Pass sessionNotesByStepId[step.id] as a prop to StepBarWithTooltip
  const [sessionNotesByStepId, setSessionNotesByStepId] = useState<{ [stepId: number]: any[] }>({});
  const [activeSessionNoteId, setActiveSessionNoteId] = useState<number | null>(null);

  // Add a global click handler to close the tooltip when clicking anywhere
  useEffect(() => {
    const handleClick = () => setActiveSessionNoteId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Helper for API responses
  const handleApiResponse = async (response: Response) => {
    if (response.status === 401) {
      onLogout()
      return null
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  // Fetch animals on mount
  useEffect(() => {
    setLoading(true)
    fetch('http://localhost:8000/animals/', {
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
  }, [token, onLogout])

  // Fetch plans for an animal
  const fetchPlans = (animalId: number) => {
    if (plansByAnimal[animalId]) return // already loaded
    fetch(`http://localhost:8000/plans/animal/${animalId}`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    })
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

  // Fetch steps for a plan
  const fetchSteps = (planId: number) => {
    fetch(`http://localhost:8000/plans/${planId}`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    })
      .then(handleApiResponse)
      .then(plan => {
        if (plan !== null && plan.steps) {
          setSteps(plan.steps);
          plan.steps.forEach((step: any) => {
            fetch(`http://localhost:8000/steps/${step.id}/notes`, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
              .then(res => res.ok ? res.json() : [])
              .then(notes => {
                setSessionNotesByStepId(prev => ({ ...prev, [step.id]: notes }));
              });
          });
        } else {
          setSteps([]);
        }
      })
      .catch(() => {
        setError('Failed to load plan steps')
      })
  }

  // Fetch session notes for a plan
  const fetchSessionNotes = (planId: number) => {
    fetch(`http://localhost:8000/plans/${planId}/notes`, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    })
      .then(handleApiResponse)
      .then(notes => {
        if (notes !== null) {
          setSessionNotesByStepId(prev => ({ ...prev, [planId]: notes }));
        }
      })
      .catch(() => {
        setSessionNotesByStepId(prev => ({ ...prev, [planId]: [] }));
      });
  };

  const handleAnimalClick = (animalId: number) => {
    setExpandedAnimalId(expandedAnimalId === animalId ? null : animalId)
    if (!plansByAnimal[animalId]) {
      fetchPlans(animalId)
    }
    setSelectedPlan(null)
    setSteps([])
    setSessionNotesByStepId({}); // Clear session notes when animal changes
  }

  const handlePlanClick = (plan: any) => {
    setSelectedPlan(plan)
    fetchSteps(plan.id)
    fetchSessionNotes(plan.id) // Fetch session notes for the selected plan
  }

  // Click outside handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.gantt-bar-tooltip')) {
        setSelectedStepIdx(null)
      }
    }
    if (selectedStepIdx !== null) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [selectedStepIdx])

  const handleSessionNotesUpdate = (stepId: number, notes: any[]) => {
    setSessionNotesByStepId(prev => ({ ...prev, [stepId]: notes }));
  };

  return (
    <div className="app-container" style={{ width: '66vw', maxWidth: 1200 }}>
      <h2>View Training Plans</h2>
      {error && <div className="error">{error}</div>}
      {loading ? (
        <div>Loading animals...</div>
      ) : (
        <div>
          {animals.map(animal => (
            <div key={animal.id} style={{ marginBottom: 16, textAlign: 'left' }}>
              <button
                onClick={() => handleAnimalClick(animal.id)}
                style={{
                  background: '#667eea',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 4
                }}
              >
                {animal.name} ({animal.species})
              </button>
              {expandedAnimalId === animal.id && plansByAnimal[animal.id] && (
                <div style={{ marginLeft: 24, marginTop: 8 }}>
                  {plansByAnimal[animal.id].length === 0 ? (
                    <div style={{ color: '#888' }}>No training plans for this animal.</div>
                  ) : (
                    plansByAnimal[animal.id].map((plan: any) => (
                      <div key={plan.id}>
                        <button
                          onClick={() => handlePlanClick(plan)}
                          style={{
                            background: selectedPlan && selectedPlan.id === plan.id ? '#48bb78' : '#edf2f7',
                            color: selectedPlan && selectedPlan.id === plan.id ? '#fff' : '#2d3748',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 14px',
                            margin: '4px 0',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          {plan.name}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {selectedPlan && (
        <div style={{ marginTop: 32, position: 'relative' }}>
          <h3 style={{ textAlign: 'left' }}>{selectedPlan.name} - Steps Overview</h3>
          {steps.length === 0 ? (
            <div style={{ color: '#888' }}>No steps for this plan.</div>
          ) : (
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              background: '#f7fafc',
              padding: 24,
              marginTop: 12,
              overflowX: 'auto',
              overflowY: 'visible', // allow vertical overflow for tooltips
              position: 'relative'
            }}>
              {/* Gantt chart with horizontal bars and cumulative session axis */}
              {(() => {
                // Calculate cumulative session counts
                let cumSessions = [0]
                steps.forEach((step, i) => {
                  cumSessions.push(cumSessions[i] + step.estimated_sessions)
                })
                const totalSessions = cumSessions[cumSessions.length - 1]
                // Axis ticks (every session)
                const axisTicks = Array.from({ length: totalSessions + 1 }, (_, i) => i + 1)
                return (
                  <div>
                    {/* Axis */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, marginLeft: 90 }}>
                      {axisTicks.map((tick, i) => (
                        <div key={i} style={{
                          width: 32,
                          textAlign: 'center',
                          fontSize: '0.95em',
                          color: '#4a5568',
                          borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0',
                          height: 18
                        }}>{tick}</div>
                      ))}
                    </div>
                    {/* Steps as Gantt bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', rowGap: 0 }}>
                      {steps.map((step, idx) => (
                        <React.Fragment key={step.id}>
                          {/* Row 1: Step label and Gantt bar */}
                          <div style={{ color: '#4a5568', fontWeight: 500, minWidth: 90 }}>Step {idx + 1}</div>
                          <div style={{ position: 'relative', height: 32 }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: cumSessions[idx] * 32,
                                width: step.estimated_sessions * 32,
                                height: 32,
                                background: step.is_complete ? '#48bb78' : '#f56565',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '1.1em',
                                boxShadow: '0 2px 8px rgba(102,126,234,0.08)',
                                cursor: 'pointer',
                                zIndex: 2
                              }}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedStepIdx(idx === selectedStepIdx ? null : idx);
                              }}
                            >
                              {idx + 1}
                            </div>
                            {selectedStepIdx === idx && (
                              <div
                                className="gantt-bar-tooltip"
                                style={{
                                  position: 'absolute',
                                  left: cumSessions[idx] * 32,
                                  top: 40,
                                  minWidth: 420,
                                  maxWidth: 600,
                                  background: '#fff',
                                  color: '#2d3748',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: '22px 32px',
                                  zIndex: 10,
                                  fontSize: '1em',
                                  whiteSpace: 'pre-line'
                                }}
                              >
                                {editingStepIdx === idx ? (
                                  <form
                                    onSubmit={async (e) => {
                                      e.preventDefault();
                                      setEditLoading(true);
                                      setEditError(null);
                                      try {
                                        const response = await fetch(`http://localhost:8000/steps/${step.id}`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                          },
                                          body: JSON.stringify({
                                            name: editForm.name,
                                            description: editForm.description,
                                            estimated_sessions: Number(editForm.estimated_sessions),
                                            is_complete: editForm.is_complete,
                                          })
                                        });
                                        if (!response.ok) {
                                          throw new Error('Failed to update step');
                                        }
                                        const updatedStep = await response.json();
                                        setSteps((prev: any[]) => prev.map((s, i) => i === idx ? { ...s, ...updatedStep } : s));
                                        setEditingStepIdx(null);
                                        setSelectedStepIdx(null);
                                      } catch (err) {
                                        setEditError('Failed to update step.');
                                      } finally {
                                        setEditLoading(false);
                                      }
                                    }}
                                    style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box', padding: '12px 10px' }}
                                  >
                                    <label style={{ fontWeight: 600 }}>Name
                                      <input
                                        type="text"
                                        value={editForm.name ?? step.name}
                                        onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
                                        required
                                      />
                                    </label>
                                    <label style={{ fontWeight: 600 }}>Description
                                      <textarea
                                        value={editForm.description ?? step.description ?? ''}
                                        onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
                                        rows={2}
                                      />
                                    </label>
                                    <label style={{ fontWeight: 600 }}>Estimated Sessions
                                      <input
                                        type="number"
                                        min={1}
                                        value={editForm.estimated_sessions ?? step.estimated_sessions}
                                        onChange={e => setEditForm((f: any) => ({ ...f, estimated_sessions: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
                                        required
                                      />
                                    </label>
                                    {editError && <div style={{ color: '#e53e3e', fontSize: '0.95em' }}>{editError}</div>}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                      <button type="submit" disabled={editLoading} style={{ background: '#48bb78', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>
                                        {editLoading ? 'Saving...' : 'Save'}
                                      </button>
                                      <button type="button" onClick={() => { setEditingStepIdx(null); setEditForm({}); }} style={{ background: '#e2e8f0', color: '#2d3748', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : addSessionStepId === step.id ? (
                                  <form
                                    style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box', padding: '12px 10px', marginTop: 12, background: '#f7fafc', borderRadius: 8 }}
                                    onSubmit={async e => {
                                      e.preventDefault();
                                      setAddSessionLoading(true);
                                      setAddSessionError(null);
                                      try {
                                        const res = await fetch(`http://localhost:8000/steps/${step.id}/notes`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                          },
                                          body: JSON.stringify({
                                            note: addSessionForm.note,
                                            performed_date: addSessionForm.performed_date
                                          })
                                        });
                                        if (!res.ok) throw new Error('Failed to add session note');
                                        if (addSessionForm.markComplete && !step.is_complete) {
                                          await fetch(`http://localhost:8000/steps/${step.id}/complete`, {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': `Bearer ${token}`
                                            }
                                          });
                                          setSteps((prev: any[]) => prev.map((s, i) => i === idx ? { ...s, is_complete: true } : s));
                                        }
                                        // Refetch session notes for this step
                                        const notesRes = await fetch(`http://localhost:8000/steps/${step.id}/notes`, {
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                          }
                                        });
                                        const notes = notesRes.ok ? await notesRes.json() : [];
                                        setAddSessionForm({});
                                        setAddSessionStepId(null);
                                        setAddSessionLoading(false);
                                        setAddSessionError(null);
                                        setActiveSessionNoteId(null);
                                        setSelectedStepIdx(null);
                                        handleSessionNotesUpdate(step.id, notes);
                                      } catch (err) {
                                        setAddSessionError('Failed to add session note.');
                                        setAddSessionLoading(false);
                                      }
                                    }}
                                  >
                                    <label style={{ fontWeight: 600 }}>
                                      Session Note
                                      <textarea
                                        value={addSessionForm.note || ''}
                                        onChange={e => setAddSessionForm((f: any) => ({ ...f, note: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
                                        rows={2}
                                      />
                                    </label>
                                    <label style={{ fontWeight: 600 }}>
                                      Performed Date
                                      <input
                                        type="date"
                                        value={addSessionForm.performed_date || new Date().toISOString().slice(0, 10)}
                                        onChange={e => setAddSessionForm((f: any) => ({ ...f, performed_date: e.target.value }))}
                                        style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
                                      />
                                    </label>
                                    <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <input
                                        type="checkbox"
                                        checked={addSessionForm.markComplete || false}
                                        onChange={e => setAddSessionForm((f: any) => ({ ...f, markComplete: e.target.checked }))}
                                      />
                                      Mark step as complete
                                    </label>
                                    {addSessionError && <div style={{ color: '#e53e3e', fontSize: '0.95em' }}>{addSessionError}</div>}
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                      <button type="submit" disabled={addSessionLoading} style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>
                                        {addSessionLoading ? 'Saving...' : 'Submit'}
                                      </button>
                                      <button type="button" onClick={() => setAddSessionStepId(null)} style={{ background: '#e2e8f0', color: '#2d3748', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>Cancel</button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <strong>Step {idx + 1} Description</strong>
                                    <div style={{ marginTop: 6 }}>{step.description || 'No description'}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                      <button
                                        style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => {
                                          setAddSessionStepId(step.id);
                                          setAddSessionForm({ note: '', performed_date: new Date().toISOString().slice(0, 10), markComplete: false });
                                        }}
                                      >Add Session</button>
                                      <button
                                        style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                                        onClick={() => {
                                          setEditingStepIdx(idx);
                                          setEditForm({
                                            name: step.name,
                                            description: step.description,
                                            estimated_sessions: step.estimated_sessions,
                                            is_complete: step.is_complete,
                                          });
                                        }}
                                      >Edit Step</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Row 2: Empty label cell and blue session bars */}
                          <div />
                          <div style={{ position: 'relative', height: 18, paddingTop: 4 }}>
                            <div style={{ position: 'absolute', left: cumSessions[idx] * 32, display: 'flex', gap: 4 }}>
                              {(sessionNotesByStepId[step.id] || []).map((note: any, i: number) => (
                                <div key={note.id || i} style={{ position: 'relative', height: 16, width: 28 }}>
                                  <div
                                    style={{ height: 16, width: 28, background: '#3182ce', borderRadius: 6, cursor: 'pointer' }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setActiveSessionNoteId(activeSessionNoteId === note.id ? null : note.id);
                                    }}
                                  />
                                  {note.note && activeSessionNoteId === note.id && (
                                    <div style={{
                                      display: 'block',
                                      position: 'absolute',
                                      left: '50%',
                                      bottom: '100%',
                                      transform: 'translateX(-50%)',
                                      background: '#2d3748',
                                      color: '#fff',
                                      padding: '8px 12px',
                                      borderRadius: 8,
                                      fontSize: '0.9em',
                                      whiteSpace: 'pre-wrap',
                                      maxWidth: 300,
                                      zIndex: 10,
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                    }}>
                                      {note.note}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
      <Link to="/">
        <button style={{ marginTop: 32 }}>Back to Dashboard</button>
      </Link>
    </div>
  )
}

// function StepBarWithTooltip({
//   step, idx, cumSessions, selectedStepIdx, setSelectedStepIdx,
//   editingStepIdx, setEditingStepIdx, editForm, setEditForm,
//   editLoading, setEditLoading, editError, setEditError, token, setSteps, sessionNotes,
//   addSessionStepId, setAddSessionStepId, addSessionForm, setAddSessionForm, addSessionLoading, setAddSessionLoading, addSessionError, setAddSessionError, onSessionNotesUpdate
// }: any) {
//   const [tooltipPos, setTooltipPos] = useState<'below' | 'above'>('below');
//   const barRef = useRef<HTMLDivElement>(null);
//   useEffect(() => {
//     if (selectedStepIdx === idx && barRef.current) {
//       const rect = barRef.current.getBoundingClientRect();
//       const spaceBelow = window.innerHeight - rect.bottom;
//       setTooltipPos(spaceBelow > 180 ? 'below' : 'above');
//     }
//   }, [selectedStepIdx, idx]);

//   // Remove the sessionNotes, setSessionNotes, showAddSession, setShowAddSession, sessionForm, setSessionForm, loadingSessionNotes, setLoadingSessionNotes state from StepBarWithTooltip. Only use the sessionNotes prop.

//   return (
//     <div style={{ marginBottom: 8 }}>
//       <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
//         <div style={{ minWidth: 90, color: '#4a5568', fontWeight: 500 }}>Step {idx + 1}</div>
//         <div ref={barRef} style={{ position: 'relative', height: 32, width: step.estimated_sessions * 32 }}>
//           <div
//             style={{
//               position: 'absolute',
//               left: cumSessions[idx] * 32,
//               width: step.estimated_sessions * 32,
//               height: 32,
//               background: step.is_complete ? '#48bb78' : '#f56565',
//               borderRadius: 8,
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'center',
//               color: '#fff',
//               fontWeight: 700,
//               fontSize: '1.1em',
//               boxShadow: '0 2px 8px rgba(102,126,234,0.08)',
//               cursor: 'pointer',
//               zIndex: 2
//             }}
//             onClick={e => {
//               e.stopPropagation();
//               setSelectedStepIdx(idx === selectedStepIdx ? null : idx)
//             }}
//           >
//             {idx + 1}
//           </div>
//           {selectedStepIdx === idx && (
//             <div
//               className="gantt-bar-tooltip"
//               style={{
//                 position: 'absolute',
//                 left: cumSessions[idx] * 32,
//                 [tooltipPos === 'below' ? 'top' : 'bottom']: 40,
//                 minWidth: 420,
//                 maxWidth: 600,
//                 background: '#fff',
//                 color: '#2d3748',
//                 border: '1px solid #cbd5e1',
//                 borderRadius: 8,
//                 boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
//                 padding: '22px 32px',
//                 zIndex: 10,
//                 fontSize: '1em',
//                 whiteSpace: 'pre-line'
//               }}
//             >
//               {editingStepIdx === idx ? (
//                 <form
//                   onSubmit={async (e) => {
//                     e.preventDefault();
//                     setEditLoading(true);
//                     setEditError(null);
//                     try {
//                       const response = await fetch(`http://localhost:8000/steps/${step.id}`, {
//                         method: 'PUT',
//                         headers: {
//                           'Content-Type': 'application/json',
//                           'Authorization': `Bearer ${token}`
//                         },
//                         body: JSON.stringify({
//                           name: editForm.name,
//                           description: editForm.description,
//                           estimated_sessions: Number(editForm.estimated_sessions),
//                           is_complete: editForm.is_complete,
//                         })
//                       });
//                       if (!response.ok) {
//                         throw new Error('Failed to update step');
//                       }
//                       const updatedStep = await response.json();
//                       setSteps((prev: any[]) => prev.map((s, i) => i === idx ? { ...s, ...updatedStep } : s));
//                       setEditingStepIdx(null);
//                       setSelectedStepIdx(null);
//                     } catch (err) {
//                       setEditError('Failed to update step.');
//                     } finally {
//                       setEditLoading(false);
//                     }
//                   }}
//                   style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box', padding: '12px 10px' }}
//                 >
//                   <label style={{ fontWeight: 600 }}>Name
//                     <input
//                       type="text"
//                       value={editForm.name ?? step.name}
//                       onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
//                       style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
//                       required
//                     />
//                   </label>
//                   <label style={{ fontWeight: 600 }}>Description
//                     <textarea
//                       value={editForm.description ?? step.description ?? ''}
//                       onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
//                       style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
//                       rows={2}
//                     />
//                   </label>
//                   <label style={{ fontWeight: 600 }}>Estimated Sessions
//                     <input
//                       type="number"
//                       min={1}
//                       value={editForm.estimated_sessions ?? step.estimated_sessions}
//                       onChange={e => setEditForm((f: any) => ({ ...f, estimated_sessions: e.target.value }))}
//                       style={{ width: '100%', boxSizing: 'border-box', marginTop: 2 }}
//                       required
//                     />
//                   </label>
//                   {editError && <div style={{ color: '#e53e3e', fontSize: '0.95em' }}>{editError}</div>}
//                   <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
//                     <button type="submit" disabled={editLoading} style={{ background: '#48bb78', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>
//                       {editLoading ? 'Saving...' : 'Save'}
//                     </button>
//                     <button type="button" onClick={() => { setEditingStepIdx(null); setEditForm({}); }} style={{ background: '#e2e8f0', color: '#2d3748', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600 }}>
//                       Cancel
//                     </button>
//                   </div>
//                 </form>
//               ) : (
//                 <>
//                   <strong>Step {idx + 1} Description</strong>
//                   <div style={{ marginTop: 6 }}>{step.description || 'No description'}</div>
//                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
//                     <button
//                       style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
//                       onClick={() => {
//                         setAddSessionStepId(step.id);
//                         setAddSessionForm({ note: '', performed_date: new Date().toISOString().slice(0, 10), markComplete: false });
//                       }}
//                     >Add Session</button>
//                     <button
//                       style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
//                       onClick={() => {
//                         setEditingStepIdx(idx);
//                         setEditForm({
//                           name: step.name,
//                           description: step.description,
//                           estimated_sessions: step.estimated_sessions,
//                           is_complete: step.is_complete,
//                         });
//                       }}
//                     >Edit Step</button>
//                   </div>
//                 </>
//               )}
//             </div>
//           )}
//         </div>
//         {sessionNotes.length > 0 && (
//           <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 2, marginLeft: cumSessions[idx] * 32, gap: 4 }}>
//             {sessionNotes.map((note: any, i: number) => (
//               <div key={note.id || i} style={{ height: 16, width: 28, background: '#3182ce', borderRadius: 6 }} />
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [_, setUser] = useState<User | null>(null)

  const handleLogin = (newToken: string, userData: User) => {
    setToken(newToken)
    setUser(userData)
    localStorage.setItem('token', newToken)
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
        <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage onLogout={handleLogout} />} />
      <Route path="/animals" element={<AnimalManagementPage token={token} onLogout={handleLogout} />} />
      <Route path="/training-plans" element={<TrainingPlanPage token={token} onLogout={handleLogout} />} />
      <Route path="/view-plans" element={<TrainingPlansListPage token={token} onLogout={handleLogout} />} />
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
      <Route path="/signup" element={<SignupPage onLogin={handleLogin} />} />
    </Routes>
  )
}

export default App
