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
            refetchOnWindowFocus: false,
            // staleTime largo: los datos se consideran frescos por 2 minutos
            // Evita refetch al cambiar entre módulos
            staleTime: 2 * 60_000,
            // gcTime: mantener cache por 10 minutos
            gcTime: 10 * 60_000,
            // Reintentar solo 1 vez
            retry: 1,
            refetchOnReconnect: true,
            // Mostrar datos anteriores mientras se cargan los nuevos
            // (en v5 se usa placeholderData en cada query individual)
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
