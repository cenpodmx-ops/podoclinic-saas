'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { ClinicThemeProvider } from '@/components/cenpod/clinic-theme-provider'

export function Providers({ children, session }: { children: React.ReactNode; session: any }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // staleTime: 5 min por defecto (módulos no operativos)
            // Módulos operativos (agenda, caja, finanzas) overridean a 30-60s individualmente
            staleTime: 5 * 60_000,
            gcTime: 10 * 60_000,
            retry: 1,
            refetchOnReconnect: true,
            // placeholderData global: mostrar datos anteriores mientras se cargan los nuevos
            // Esto elimina el skeleton parpadeante al navegar entre módulos
            placeholderData: keepPreviousData,
          },
        },
      })
  )
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ClinicThemeProvider>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </ClinicThemeProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
