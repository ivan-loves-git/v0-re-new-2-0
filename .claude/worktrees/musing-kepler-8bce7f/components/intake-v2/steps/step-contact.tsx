'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/lib/i18n/language-context'
import type { IntakeV2StepProps, FileUploadState } from '@/lib/types/intake-v2'
import { Upload, FileText, X, Loader2 } from 'lucide-react'

/**
 * Step 1: Contact Information
 * Collects: first name, last name, email, phone, CV upload, LinkedIn (optional)
 */
export function StepContact({ data, onChange, onNext, errors = {} }: IntakeV2StepProps) {
  const { t } = useLanguage()
  const [cvUpload, setCvUpload] = useState<FileUploadState>({
    file: null,
    uploading: false,
    progress: 0,
    url: data.cv_url || null,
    error: null
  })

  // Sync local cvUpload state when data.cv_url changes externally (e.g., from autofill)
  useEffect(() => {
    if (data.cv_url && data.cv_url !== cvUpload.url) {
      setCvUpload(prev => ({ ...prev, url: data.cv_url || null }))
    }
  }, [data.cv_url])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!validTypes.includes(file.type)) {
      setCvUpload(prev => ({ ...prev, error: t('errorFileType') }))
      return
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setCvUpload(prev => ({ ...prev, error: t('errorFileSize') }))
      return
    }

    setCvUpload(prev => ({ ...prev, file, uploading: true, error: null }))

    try {
      // Create form data for upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'cv')

      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const { url } = await response.json()
      setCvUpload(prev => ({ ...prev, uploading: false, url }))
      onChange({ cv_url: url })
    } catch {
      setCvUpload(prev => ({ ...prev, uploading: false, error: t('errorUpload') }))
    }
  }

  const removeFile = () => {
    setCvUpload({ file: null, uploading: false, progress: 0, url: null, error: null })
    onChange({ cv_url: null })
  }

  const isValid = () => {
    return (
      data.first_name?.trim() &&
      data.last_name?.trim() &&
      data.email?.trim() &&
      data.phone?.trim() &&
      cvUpload.url
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{t('step1Title')}</h2>
        <p className="text-muted-foreground">
          {t('step1Description')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="first_name">{t('firstName')} *</Label>
          <Input
            id="first_name"
            value={data.first_name || ''}
            onChange={(e) => onChange({ first_name: e.target.value })}
            placeholder="Jean"
            className={errors.first_name ? 'border-red-500' : ''}
          />
          {errors.first_name && (
            <p className="text-sm text-red-500">{errors.first_name}</p>
          )}
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="last_name">{t('lastName')} *</Label>
          <Input
            id="last_name"
            value={data.last_name || ''}
            onChange={(e) => onChange({ last_name: e.target.value })}
            placeholder="Dupont"
            className={errors.last_name ? 'border-red-500' : ''}
          />
          {errors.last_name && (
            <p className="text-sm text-red-500">{errors.last_name}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('email')} *</Label>
        <Input
          id="email"
          type="email"
          value={data.email || ''}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="jean.dupont@email.com"
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">{t('phone')} *</Label>
        <Input
          id="phone"
          type="tel"
          value={data.phone || ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+33 6 12 34 56 78"
          className={errors.phone ? 'border-red-500' : ''}
        />
        {errors.phone && (
          <p className="text-sm text-red-500">{errors.phone}</p>
        )}
      </div>

      {/* CV Upload */}
      <div className="space-y-2">
        <Label>{t('cv')} *</Label>
        <p className="text-sm text-muted-foreground">{t('cvHelpText')}</p>

        {cvUpload.url ? (
          <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
            <FileText className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm truncate">{t('cvUploaded')}</span>
            <Button variant="ghost" size="sm" onClick={removeFile}>
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={cvUpload.uploading}
            />
            <div className={`flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-md hover:border-primary/50 transition-colors ${errors.cv_url ? 'border-red-500' : ''}`}>
              {cvUpload.uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {cvUpload.uploading ? t('uploading') : t('cvUploadText')}
              </span>
            </div>
          </div>
        )}
        {cvUpload.error && (
          <p className="text-sm text-red-500">{cvUpload.error}</p>
        )}
        {errors.cv_url && (
          <p className="text-sm text-red-500">{errors.cv_url}</p>
        )}
      </div>

      {/* LinkedIn (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="linkedin_url">{t('linkedin')}</Label>
        <Input
          id="linkedin_url"
          type="url"
          value={data.linkedin_url || ''}
          onChange={(e) => onChange({ linkedin_url: e.target.value })}
          placeholder="https://linkedin.com/in/jeandupont"
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!isValid()}>
          {t('continue')}
        </Button>
      </div>
    </div>
  )
}
