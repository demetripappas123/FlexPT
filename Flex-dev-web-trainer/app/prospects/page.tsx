import AddProspectDialog from '@/modules/prospects/addprospect'
import DisplayProspects from '@/modules/prospects/displayprospects'

export default function ProspectsPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <h1 className="text-3xl font-bold mb-4">Prospects</h1>
      <DisplayProspects />
      <AddProspectDialog />
    </div>
  )
}
