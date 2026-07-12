export default function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100svh-8rem)] flex-col overflow-hidden rounded-lg border bg-background">
      {children}
    </div>
  )
}
