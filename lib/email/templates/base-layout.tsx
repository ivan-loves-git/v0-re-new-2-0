import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components"
import * as React from "react"

interface BaseLayoutProps {
  previewText: string
  children: React.ReactNode
}

// Re-New brand colors
const colors = {
  primary: "#2563eb", // Blue
  primaryDark: "#1d4ed8",
  text: "#1f2937",
  textLight: "#6b7280",
  background: "#ffffff",
  border: "#e5e7eb",
}

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif'

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>Re-New</Text>
          </Section>

          {/* Main Content */}
          <Section style={main}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Vous recevez cet email car vous vous etes inscrit sur Re-New.
            </Text>
            <Text style={footerText}>
              <Link href="https://re-new.com" style={footerLink}>
                re-new.com
              </Link>
            </Text>
            <Text style={footerTextSmall}>
              Re-New SAS - Paris, France
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const body: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily,
  margin: 0,
  padding: "20px 0",
}

const container: React.CSSProperties = {
  backgroundColor: colors.background,
  margin: "0 auto",
  maxWidth: "600px",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
}

const header: React.CSSProperties = {
  backgroundColor: colors.primary,
  padding: "24px",
  textAlign: "center" as const,
}

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "bold",
  margin: 0,
  letterSpacing: "-0.5px",
}

const main: React.CSSProperties = {
  padding: "32px 24px",
}

const hr: React.CSSProperties = {
  borderColor: colors.border,
  margin: "0",
}

const footer: React.CSSProperties = {
  padding: "24px",
  textAlign: "center" as const,
}

const footerText: React.CSSProperties = {
  color: colors.textLight,
  fontSize: "14px",
  margin: "0 0 8px 0",
}

const footerTextSmall: React.CSSProperties = {
  color: colors.textLight,
  fontSize: "12px",
  margin: "16px 0 0 0",
}

const footerLink: React.CSSProperties = {
  color: colors.primary,
  textDecoration: "none",
}

// Shared text styles for templates
export const heading: React.CSSProperties = {
  color: colors.text,
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
  lineHeight: "1.3",
}

export const paragraph: React.CSSProperties = {
  color: colors.text,
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
}

export const button: React.CSSProperties = {
  backgroundColor: colors.primary,
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
}

export const highlight: React.CSSProperties = {
  backgroundColor: "#f0f9ff",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
}

export const highlightText: React.CSSProperties = {
  color: colors.primary,
  fontSize: "32px",
  fontWeight: "bold",
  margin: "0",
  textAlign: "center" as const,
}
