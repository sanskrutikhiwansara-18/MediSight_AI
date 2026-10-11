import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import AppShell from './components/AppShell.jsx'
import PatientLayout from './pages/patient/PatientLayout.jsx'
import PatientOverview from './pages/patient/PatientOverview.jsx'
import PatientRecords from './pages/patient/PatientRecords.jsx'
import PatientInsights from './pages/patient/PatientInsights.jsx'
import PatientShare from './pages/patient/PatientShare.jsx'
import ClinicianDashboard from './pages/ClinicianDashboard.jsx'
import PatientProfile from './pages/PatientProfile.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminAudit from './pages/AdminAudit.jsx'
import RepresentativeLogin from './pages/RepresentativeLogin.jsx'
import RepresentativeDashboard from './pages/RepresentativeDashboard.jsx'
import { useAuth } from './lib/auth.jsx'
import { homeFor } from './lib/roles.js'

/**
 * Mirrors the backend: a page for one role redirects other roles to their own
 * home instead of rendering data they aren't allowed to see. The server
 * enforces the same rule on every API call.
 */
function RequireRole({ role, children }) {
  const { auth } = useAuth()
  if (!auth) return <Navigate to={`/login?role=${role}`} replace />
  if (auth.role !== role) return <Navigate to={homeFor(auth.role)} replace />
  return children
}

function GuestOnly({ children }) {
  const { auth } = useAuth()
  return auth ? <Navigate to={homeFor(auth.role)} replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route path="/representative/login" element={<GuestOnly><RepresentativeLogin /></GuestOnly>} />

      <Route
        element={
          <RequireRole role="patient">
            <AppShell />
          </RequireRole>
        }
      >
        <Route element={<PatientLayout />}>
          <Route path="/patient" element={<PatientOverview />} />
          <Route path="/patient/records" element={<PatientRecords />} />
          <Route path="/patient/insights" element={<PatientInsights />} />
          <Route path="/patient/share" element={<PatientShare />} />
        </Route>
      </Route>

      <Route
        element={
          <RequireRole role="clinician">
            <AppShell />
          </RequireRole>
        }
      >
        <Route path="/dashboard" element={<ClinicianDashboard />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
      </Route>

      <Route
        element={
          <RequireRole role="representative">
            <AppShell />
          </RequireRole>
        }
      >
        <Route path="/representative" element={<RepresentativeDashboard />} />
      </Route>

      <Route
        element={
          <RequireRole role="admin">
            <AppShell />
          </RequireRole>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
