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
            // No refetch al volver a la ventana — evita recargas innecesarias
            refetchOnWindowFocus: false,
            // staleTime más largo: los datos se consideran frescos por 1 minuto
            // Esto evita refetch al cambiar entre módulos
            staleTime: 60_000,
            // gcTime: mantener cache por 5 minutos (para volver a módulos rápido)
            gcTime: 5 * 60_000,
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
