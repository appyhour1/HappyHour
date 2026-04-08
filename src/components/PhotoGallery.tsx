/**
 * PhotoGallery.tsx
 *
 * Venue photo gallery for detail pages.
 * Users can upload photos of happy hour menu boards, the bar, drinks, etc.
 * Photos stored in Supabase Storage bucket "venue-photos".
 *
 * SETUP REQUIRED (one time in Supabase):
 *   1. Go to Storage in Supabase dashboard
 *   2. Create a new bucket called "venue-photos"
 *   3. Set it to Public
 *   4. That's it — the app handles the rest
 */

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Photo {
  url: string
  name: string
  created_at?: string
}

interface PhotoGalleryProps {
  venueId: string
  venueName: string
}

export function PhotoGallery({ venueId, venueName }: PhotoGalleryProps) {
  const [photos, setPhotos]       = useState<Photo[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightbox, setLightbox]   = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load photos for this venue
  useEffect(() => {
    loadPhotos()
  }, [venueId])

  async function loadPhotos() {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from('venue-photos')
        .list(`venues/${venueId}`, {
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        // Bucket might not exist yet — show empty state
        setPhotos([])
        setLoading(false)
        return
      }

      const photoList: Photo[] = (data ?? [])
        .filter(f => !f.name.startsWith('.'))
        .map(f => {
          const { data: urlData } = supabase.storage
            .from('venue-photos')
            .getPublicUrl(`venues/${venueId}/${f.name}`)
          return {
            url: urlData.publicUrl,
            name: f.name,
            created_at: f.created_at,
          }
        })

      setPhotos(photoList)
    } catch {
      setPhotos([])
    }
    setLoading(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Photo must be under 10MB.')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop() ?? 'jpg'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `venues/${venueId}/${filename}`

      const { error } = await supabase.storage
        .from('venue-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (error) {
        if (error.message.includes('Bucket not found')) {
          setUploadError('Photo storage not set up yet. See setup instructions.')
        } else {
          setUploadError('Upload failed. Please try again.')
        }
        setUploading(false)
        return
      }

      // Reload photos
      await loadPhotos()
    } catch {
      setUploadError('Upload failed. Please try again.')
    }

    setUploading(false)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="gallery">
      {/* Header */}
      <div className="gallery-header">
        <h2 className="detail-section-title" style={{ marginBottom: 0 }}>
          Photos
          {photos.length > 0 && <span className="gallery-count">{photos.length}</span>}
        </h2>
        <label className="gallery-upload-btn">
          {uploading ? (
            <span className="gallery-uploading">
              <span className="cf-spinner" /> Uploading...
            </span>
          ) : (
            <span>📷 Add photo</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {uploadError && (
        <div className="gallery-error">{uploadError}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="gallery-loading">Loading photos...</div>
      ) : photos.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon">📷</div>
          <p className="gallery-empty-text">
            No photos yet — be the first to add one!
          </p>
          <p className="gallery-empty-sub">
            Snap the happy hour board, your drinks, or the vibe.
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo, i) => (
            <button
              key={photo.name}
              className="gallery-thumb-btn"
              onClick={() => setLightbox(photo.url)}
              aria-label={`View photo ${i + 1}`}
            >
              <img
                src={photo.url}
                alt={`${venueName} photo ${i + 1}`}
                className="gallery-thumb"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="gallery-lightbox"
          onClick={() => setLightbox(null)}
        >
          <button
            className="gallery-lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >✕</button>
          <img
            src={lightbox}
            alt={`${venueName} photo`}
            className="gallery-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
