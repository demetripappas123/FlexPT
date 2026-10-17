import AddProspectDialog from '@/modules/prospects/addprospect'
import ProspectFunnel from '@/modules/prospects/prospectfunnel'

export default function ProspectsPage() {
  return (
    <div className="w-full h-full bg-background text-foreground p-6">
      <h1 className="text-[26px] font-normal tracking-tight mb-4">Prospects</h1>
      <ProspectFunnel />
      <AddProspectDialog />
    </div>
  )
}
