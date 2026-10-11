import React from 'react'
import { FileHeart } from 'lucide-react'
import { PageHeader, EmptyState } from '../../components/ui.jsx'
import RecordViewer from '../../components/RecordViewer.jsx'
import BloodGroupCard from '../../components/BloodGroupCard.jsx'
import MonthlyHealthHistory from '../../components/MonthlyHealthHistory.jsx'
import { isEmptyRecord } from '../../lib/records.js'
import { usePatient } from './PatientLayout.jsx'

export default function PatientRecords() {
  const { record, reloadRecord } = usePatient()
  return (
    <>
      <PageHeader
        title="Health records"
        subtitle={`Record ${record.patient_ref}. Conditions, medications, lab results and visits.`}
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <BloodGroupCard record={record} onUpdated={reloadRecord} />
        <MonthlyHealthHistory record={record} />
      </div>
      {isEmptyRecord(record) ? (
        <div className="card">
          <EmptyState icon={FileHeart} title="Nothing on file yet">
            Once conditions, prescriptions, lab results or visits are added to your record, they’re listed here.
          </EmptyState>
        </div>
      ) : (
        <RecordViewer record={record} />
      )}
    </>
  )
}
