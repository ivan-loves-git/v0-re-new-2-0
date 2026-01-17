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
  Img,
} from "@react-email/components"
import * as React from "react"

interface BaseLayoutProps {
  previewText: string
  children: React.ReactNode
}

// Re-New brand colors (from re-new.team website)
const colors = {
  brand: "#4361ee", // Royal blue from website
  text: "#1e3a5f", // Dark blue-gray for text
  textLight: "#64748b", // Muted blue-gray
  background: "#f5f7fa", // Light gray background
  cardBg: "#ffffff",
  border: "#e2e8f0",
}

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif'

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={header}>
            <Img
              src="https://cdn.prod.website-files.com/68a87ebceebd6aec9fa8d6b3/68b6fe358d32a837b0522d9a_Logo.svg"
              alt="Re-New"
              width="100"
              height="auto"
              style={logoImg}
            />
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
              <Link href="https://re-new.team" style={footerLink}>
                re-new.team
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
  backgroundColor: colors.background,
  fontFamily,
  margin: 0,
  padding: "32px 16px",
}

const container: React.CSSProperties = {
  backgroundColor: colors.cardBg,
  margin: "0 auto",
  maxWidth: "560px",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
}

const header: React.CSSProperties = {
  backgroundColor: colors.cardBg,
  padding: "32px 24px 24px",
  textAlign: "center" as const,
  borderBottom: `1px solid ${colors.border}`,
}

const logoImg: React.CSSProperties = {
  margin: "0 auto",
}

const main: React.CSSProperties = {
  padding: "32px 24px",
}

const hr: React.CSSProperties = {
  borderColor: colors.border,
  margin: "0",
}

const footer: React.CSSProperties = {
  padding: "24px 24px 32px",
  textAlign: "center" as const,
  backgroundColor: colors.background,
}

const footerText: React.CSSProperties = {
  color: colors.textLight,
  fontSize: "13px",
  margin: "0 0 8px 0",
}

const footerTextSmall: React.CSSProperties = {
  color: colors.textLight,
  fontSize: "12px",
  margin: "12px 0 0 0",
}

const footerLink: React.CSSProperties = {
  color: colors.brand,
  textDecoration: "none",
}

// Shared text styles for templates
export const heading: React.CSSProperties = {
  color: colors.brand,
  fontSize: "22px",
  fontWeight: "600",
  margin: "0 0 16px 0",
  lineHeight: "1.4",
}

export const paragraph: React.CSSProperties = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 16px 0",
}

export const button: React.CSSProperties = {
  backgroundColor: colors.brand,
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: "500",
  padding: "12px 28px",
  textDecoration: "none",
  textAlign: "center" as const,
}

export const highlight: React.CSSProperties = {
  backgroundColor: colors.background,
  borderRadius: "12px",
  padding: "20px",
  margin: "20px 0",
}

export const highlightText: React.CSSProperties = {
  color: colors.brand,
  fontSize: "28px",
  fontWeight: "600",
  margin: "0",
  textAlign: "center" as const,
}
