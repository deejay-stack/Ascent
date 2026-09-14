import { Construction } from 'lucide-react'

type WorkspacePageProps = {
  title: string
  description: string
}

export function WorkspacePage({ title, description }: WorkspacePageProps) {
  return (
    <section className="workspace-page">
      <span className="workspace-icon">
        <Construction size={24} />
      </span>
      <p className="eyebrow">Module route ready</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="status-callout">
        This route is included in the application shell. Its data and workflows belong to a later
        implementation phase.
      </div>
    </section>
  )
}
