// Main form component
export { IntakeFormV2 } from "./intake-form-v2"

// Form configuration
export {
  type IntakeFormData,
  getInitialFormValues,
  validateStep,
  stepSchemas,
  fullFormSchema,
  FORM_STORAGE_KEY,
  STEP_STORAGE_KEY,
} from "./form-config"

// Hooks
export { useFormPersistence } from "./hooks/use-form-persistence"
export { useAutoSave } from "./hooks/use-auto-save"

// UI Components
export { GlassProgress } from "./components/glass-progress"
export { FloatingInput, FloatingTextarea } from "./components/floating-input"
export { FileDropZone } from "./components/file-drop-zone"
export { CompletionScreen } from "./components/completion-screen"

// Step components
export { StepContact } from "./steps/step-contact"
export { StepBackground } from "./steps/step-background"
export { StepMAExperience } from "./steps/step-ma-experience"
export { StepGoals } from "./steps/step-goals"
export { StepFinancial } from "./steps/step-financial"
