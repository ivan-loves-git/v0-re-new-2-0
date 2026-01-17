"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Mail } from "lucide-react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      })

      if (result.error) {
        setError(result.error.message || "Failed to send reset email")
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
              <p className="text-gray-500 mb-6">
                We sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <Link
                href="/auth/login"
                className="text-blue-500 hover:text-blue-600 font-medium"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to sign in
              </Link>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot password?</h1>
              <p className="text-gray-500 mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 bg-blue-500 hover:bg-blue-600 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
