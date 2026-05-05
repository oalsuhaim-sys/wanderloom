'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function DeprecatedCRMClientPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  useEffect(() => {
    if (!id) return
    router.replace(`/crm/clients/${id}`)
  }, [id, router])

  return null
}

