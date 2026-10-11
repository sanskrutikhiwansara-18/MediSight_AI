import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import api, { errorMessage } from '../../services/api'
import { isEmptyRecord } from '../../lib/records.js'
import { ErrorNote, Spinner } from '../../components/ui.jsx'

const PatientContext = createContext(null)

export function usePatient() {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('usePatient must be used inside PatientLayout')
  return ctx
}

/**
 * Loads the signed-in patient's own record (and, when there is something to
 * score, their risk) once, then shares it with every patient page so moving
 * between tabs doesn't refetch or re-run the model.
 */
export default function PatientLayout() {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState(null)
  const [risk, setRisk] = useState({ status: 'idle', data: null, error: null })

  const loadRisk = useCallback(() => {
    setRisk({ status: 'loading', data: null, error: null })
    api
      .get('/me/risk')
      .then((r) => setRisk({ status: 'ready', data: r.data, error: null }))
      .catch((e) => setRisk({ status: 'error', data: null, error: errorMessage(e, 'The risk model is unavailable right now.') }))
  }, [])

  const load = useCallback(() => {
    setError(null)
    api
      .get('/me/record')
      .then((r) => {
        setRecord(r.data)
        // A score built from age and sex alone would look more certain than
        // it is, so only score once there is something in the record.
        if (!isEmptyRecord(r.data)) loadRisk()
        else setRisk({ status: 'idle', data: null, error: null })
      })
      .catch((e) => setError(errorMessage(e, 'Could not load your record.')))
  }, [loadRisk])

  useEffect(load, [load])

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <button onClick={load} className="btn-outline btn-sm">Try again</button>
      </div>
    )
  }
  if (!record) return <Spinner label="Loading your record…" />

  return (
    <PatientContext.Provider value={{ record, risk, reloadRisk: loadRisk, reloadRecord: load }}>
      <Outlet />
    </PatientContext.Provider>
  )
}
