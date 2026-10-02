'use client'

import { useRef } from 'react'
import AddClientDialog from '@/modules/clients/addclient'
import DisplayClients, { DisplayClientsRef } from '@/modules/clients/displayclients'

export default function ClientsPage() {
  const displayClientsRef = useRef<DisplayClientsRef>(null)

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Clients</h1>
        <AddClientDialog onClientAdded={() => displayClientsRef.current?.refresh()} />
      </div>
      <DisplayClients ref={displayClientsRef} />
    </div>
  )
}
