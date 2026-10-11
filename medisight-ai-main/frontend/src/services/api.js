import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('medisight_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// An expired or revoked session should send the person back to sign in
// instead of leaving every card showing "Could not validate credentials".
// Auth endpoints are excluded because a wrong password is also a 401.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''
    if (status === 401 && !url.startsWith('/auth/') && localStorage.getItem('medisight_token')) {
      localStorage.removeItem('medisight_token')
      localStorage.removeItem('medisight_role')
      localStorage.removeItem('medisight_name')
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

// FastAPI returns either {detail: "text"} or, for validation errors,
// {detail: [{loc, msg}, ...]}. Turn both into one readable sentence.
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : ''
    const msg = String(first.msg || '').replace(/^Value error,\s*/i, '')
    return field && !msg.toLowerCase().includes(String(field).toLowerCase())
      ? `${humanField(field)}: ${msg}`
      : msg || fallback
  }
  if (!err?.response) return 'Cannot reach the server. Check that the backend is running.'
  return fallback
}

function humanField(field) {
  const map = { full_name: 'Full name', email: 'Email', password: 'Password', age: 'Age', gender: 'Gender', region: 'Region' }
  return map[field] || field
}

export default api
