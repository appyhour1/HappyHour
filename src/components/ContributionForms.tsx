/**
 * ContributionForms.tsx
 */

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
              { type: 'text', text: `Extract happy hour info from this image. Respond ONLY with JSON:
{"name":"","neighborhood":"","schedule_description":"","deal_details":""}` }
            ]}]
          })
        })
        const data = await response.json()
        if (data.error) throw new Error(data.error.message)
        const text = (data.content || []).map((c: any) => c.text || '').join('')
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        setForm(f => ({
          ...f,
          name: parsed.name || f.name,
          neighborhood: parsed.neighborhood || f.neighborhood,
          schedule_description: parsed.schedule_description || f.schedule_description,
          deal_details: parsed.deal_details || f.deal_details,
        }))
      } catch {
        setPhotoError('Could not read the image. Try a clearer photo or fill in manually.')
      }
      setPhotoLoading(false)
    }
    reader.readAsDataURL(file)
  }

  function fieldError(field: string) {
    return errors.find(e => e.field === field)?.message
  }

  function set(field: keyof NewVenueSubmission, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(prev => prev.filter(e => e.field !== field))
  }

  async function handleSubmit() {
    const errs = validateNewVenue(form)
    if (errs.length > 0) { setErrors(errs); return }
    setStatus('submitting')
    const result = await submitContribution(form as NewVenueSubmission)
    setResultMessage(result.message)
    setStatus(result.success ? 'success' : 'error')
  }

  if (status === 'success') {
    return (
      <div className="cf-success">
        <div className="cf-success-icon">🎉</div>
        <div className="cf-success-title">Submitted!</div>
        <p className="cf-success-msg">{resultMessage}</p>
        <button className="cf-btn-primary" onClick={onClose ?? (() => setStatus('idle'))}>Done</button>
      </div>
    )
  }

  return (
    <div className="cf-form">
      <div className="cf-header">
        <h2 className="cf-title">Add a new spot</h2>
        <p className="cf-subtitle">Help the community find great happy hours.</p>
      </div>

      <div className="cf-photo-zone" onClick={() => document.getElementById('cf-photo-input')?.click()}>
        {photoLoading ? (
          <div className="cf-photo-loading"><div className="cf-spinner" /><span>Reading image...</span></div>
        ) : photoPreview ? (
          <div className="cf-photo-preview">
            <img src={photoPreview} alt="uploaded" className="cf-photo-thumb" />
            <div>
              <div className="cf-photo-ok">✓ Form filled from photo</div>
              <div className="cf-photo-retry">Tap to use a different photo</div>
            </div>
          </div>
        ) : (
          <div className="cf-photo-placeholder">
            <span className="cf-photo-icon">📷</span>
            <span className="cf-photo-title">Upload a photo to auto-fill</span>
            <span className="cf-photo-sub">Chalkboard sign, menu, or flyer</span>
          </div>
        )}
      </div>
      {photoError && <div className="cf-error-banner">{photoError}</div>}
      <input id="cf-photo-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
      <div className="cf-divider"><span>or fill in manually</span></div>

      <Field label="Ba
