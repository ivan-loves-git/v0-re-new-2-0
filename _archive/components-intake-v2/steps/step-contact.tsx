"use client"

import { motion } from "framer-motion"
import { User, Mail, Phone, Linkedin } from "lucide-react"
import { FloatingInput } from "../components/floating-input"
import { FileDropZone } from "../components/file-drop-zone"
import type { IntakeFormData } from "../form-config"

interface StepContactProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any // TanStack Form instance - complex generic, using any for simplicity
  cvFile: File | null
  onCvChange: (file: File | null) => void
  isUploadingCv: boolean
  fieldErrors?: Record<string, string> // External validation errors from Zod
}

/**
 * Step 1: Contact Information
 */
export function StepContact({ form, cvFile, onCvChange, isUploadingCv, fieldErrors = {} }: StepContactProps) {
  return (
    <div className="space-y-6">
      {/* Name fields - side by side on larger screens */}
      <div className="grid sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <form.Field name="first_name">
            {(field: { state: { value: string }; handleChange: (v: string) => void }) => (
              <FloatingInput
                label="First Name"
                value={field.state.value}
                onChange={field.handleChange}
                error={fieldErrors.first_name}
                required
                icon={<User className="w-5 h-5" />}
                placeholder="John"
              />
            )}
          </form.Field>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <form.Field name="last_name">
            {(field: { state: { value: string }; handleChange: (v: string) => void }) => (
              <FloatingInput
                label="Last Name"
                value={field.state.value}
                onChange={field.handleChange}
                error={fieldErrors.last_name}
                required
                placeholder="Doe"
              />
            )}
          </form.Field>
        </motion.div>
      </div>

      {/* Email */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <form.Field name="email">
          {(field: { state: { value: string }; handleChange: (v: string) => void }) => (
            <FloatingInput
              label="Email Address"
              value={field.state.value}
              onChange={field.handleChange}
              type="email"
              error={fieldErrors.email}
              required
              icon={<Mail className="w-5 h-5" />}
              placeholder="john@example.com"
            />
          )}
        </form.Field>
      </motion.div>

      {/* Phone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <form.Field name="phone">
          {(field: { state: { value: string }; handleChange: (v: string) => void }) => (
            <FloatingInput
              label="Phone"
              value={field.state.value ?? ""}
              onChange={field.handleChange}
              type="tel"
              error={fieldErrors.phone}
              icon={<Phone className="w-5 h-5" />}
              placeholder="+33 6 12 34 56 78"
              pattern="[\d\s\-+().]{7,20}"
              minLength={7}
            />
          )}
        </form.Field>
      </motion.div>

      {/* LinkedIn */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <form.Field name="linkedin_url">
          {(field: { state: { value: string }; handleChange: (v: string) => void }) => (
            <FloatingInput
              label="LinkedIn"
              value={field.state.value ?? ""}
              onChange={field.handleChange}
              type="url"
              error={fieldErrors.linkedin_url}
              icon={<Linkedin className="w-5 h-5" />}
              placeholder="linkedin.com/in/johndoe"
            />
          )}
        </form.Field>
      </motion.div>

      {/* CV Upload */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <FileDropZone
          file={cvFile}
          onFileChange={onCvChange}
          title="Upload your CV"
          description="Optional, PDF only (max 10MB)"
          isUploading={isUploadingCv}
          variant="default"
        />
      </motion.div>
    </div>
  )
}
