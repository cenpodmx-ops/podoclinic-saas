'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Refetch al volver a la ventana (para datos frescos)
            refetchOnWindowFocus: true,
            // staleTime corto: los datos se consideran "viejos" rápido → refetch automático
            staleTime: 5_000,
            // gcTime corto: limpiar cache rápidamente para no mostrar datos viejos
            gcTime: 30_000,
            // Reintentar solo 1 vez
            retry: 1,
            // No pausar refetch cuando hay conexión
            refetchOnReconnect: true,
          },
        },
      })
  )
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
