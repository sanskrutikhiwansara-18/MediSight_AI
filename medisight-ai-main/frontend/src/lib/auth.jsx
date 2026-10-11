import React, { createContext, useContext, useState, useCallback } from 'react'
import api, { errorMessage } from '../services/api'

const AuthContext = createContext(null)

function persist({ access_token, role, full_name }) {
  localStorage.setItem('medisight_token', access_token)
  localStorage.setItem('medisight_role', role)
  localStorage.setItem('medisight_name', full_name)
  return { token: access_token, role, fullName: full_name }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('medisight_token')
    const role = localStorage.getItem('medisight_role')
    const fullName = localStorage.getItem('medisight_name')
    return token ? { token, role, fullName } : null
  })

  // `role` is the tab the person picked on the sign-in page; the server
  // rejects the attempt if the account belongs to a different role.
  const login = useCallback(async (email, password, role) => {
    try {
      const resp = await api.post('/auth/login', { email, password, role })
      const next = persist(resp.data)
      setAuth(next)
      return { role: next.role }
    } catch (e) {
      throw new Error(errorMessage(e, 'Sign-in failed. Check your email and password.'))
    }
  }, [])

  const registerPatient = useCallback(async (payload) => {
    try {
      const resp = await api.post('/auth/register/patient', payload)
      const next = persist(resp.data)
      setAuth(next)
      return { role: next.role }
    } catch (e) {
      throw new Error(errorMessage(e, 'We could not create your account.'))
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('medisight_token')
    localStorage.removeItem('medisight_role')
    localStorage.removeItem('medisight_name')
    sessionStorage.removeItem('medisight_recent_patients')
    setAuth(null)
  }, [])

  return (
    <AuthContext.Provider value={{ auth, login, registerPatient, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
