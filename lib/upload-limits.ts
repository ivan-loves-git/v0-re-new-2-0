/**
 * CV and Lettre de cadrage uploads transit a Vercel Function whose request
 * envelope is capped at 4.5 MB. The file limit leaves bounded multipart
 * overhead while keeping one shared contract across every client and server.
 */
export const CV_LDC_MAX_FILE_BYTES = 4 * 1024 * 1024
export const CV_LDC_MAX_FILE_LABEL = "4 MB"
export const VERCEL_FUNCTION_MAX_REQUEST_BYTES = 4.5 * 1024 * 1024
