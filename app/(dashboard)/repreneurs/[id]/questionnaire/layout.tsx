export default function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout removes the parent's p-6 padding using negative margins
  // and sets explicit height to fill the available space
  return (
    <div className="-m-6 h-[calc(100vh-64px)] flex flex-col">
      {children}
    </div>
  )
}
