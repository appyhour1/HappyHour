import React, { useState } from 'react'
import type { Venue } from '../types'
import {
  submitContribution,
  validateNewVenue,
  validateEditSuggestion,
  type NewVenueSubmission,
  type EditSuggestion,
  type ValidationError,
} from '../services/contributionService'

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="cf-field">
      <label className="cf-label">{label}{required && <span className="cf-required"> *</span>}</label>
      {children}
      {error && <span className="cf-error">{error}</span>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="cf-input" {...props} />
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="cf-textarea" {...props} />
}

const EMPTY_NEW: Partial<NewVenueSubmission> = {
  flow: 'new_venue', name: '', address: '', neighborhood: '',
  city: 'Cincinnati', website: '', phone: '',
  schedule_description: '', deal_details: '', notes: '', submitter_email: '',
}

export function NewVenueForm({ onClose }: { onClose?: () => void }) {
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [dogFriendly, setDogFriendly] = useState(false)
  const [form, setForm] = useState<Partial<NewVenueSubmission>>(EMPTY_NEW)
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [resultMessage, setResultMessage] = useState('')

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setPhotoPreview(base64)
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: base64.split(',')[1] } },
              { type: 'text', text: 'Extract happy hour info from this image. Respond ONLY with JSON: {"name":"","neighborhood":"","schedule_description":"","deal_details":""}' }
            ]}]
          })
        })
        const data = await response.json()
