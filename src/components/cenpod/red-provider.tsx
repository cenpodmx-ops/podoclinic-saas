'use client'

/**
 * RedProvider — contexto de tiempo real para el módulo Red PodoClinic.
 *
 * Conecta al mini-servicio socket.io en puerto 3003 vía Caddy:
 *   io("/?XTransformPort=3003", { path: "/red-ws" })
 *
 * Escucha `red:message`, `red:notice`, `red:order` y:
 *  - Invalida queries de TanStack Query relevantes (refresca listas).
 *  - Dispara toasts de sonner.
 *  - Mantiene contadores de no-leídos que expone vía contexto.
 *
 * El TopBar usa `useRed()` para pintar el badge de la campanita.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bell, Info, AlertTriangle, GraduationCap, Package } from 'lucide-react'

// ---------- Tipos ----------
export type RedPayload = {
  id: string
  subject?: string
  body?: string
  title?: string
  type?: string
  status?: string
  urgency?: string
  fromClinicId?: string
  toClinicId?: string
  fromClinic?: { id: string; name: string }
  toClinic?: { id: string; name: string }
  createdAt?: string
}

type RedContextValue = {
  connected: boolean
  unreadMessages: number
  unreadNotices: number
  unreadOrders: number
  /** Total agregado para el badge de la campanita. */
  totalUnread: number
  /** Reinicia un contador específico (cuando el usuario entra a esa vista). */
  reset: (which: 'messages' | 'notices' | 'orders') => void
  /** Lista pequeña de eventos recientes para el dropdown de la campanita. */
  recent: RecentEvent[]
  clearRecent: () => void
}

type RecentEvent = {
  id: string
  kind: 'message' | 'notice' | 'order'
  title: string
  subtitle: string
  at: number
}

const RedContext = createContext<RedContextValue | null>(null)

export function useRed() {
  const ctx = useContext(RedContext)
  if (!ctx) return null
  return ctx
}

const MAX_RECENT = 8

export function RedProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const qc = useQueryClient()
  const socketRef = useRef<Socket | null>(null)

  const [connected, setConnected] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotices, setUnreadNotices] = useState(0)
  const [unreadOrders, setUnreadOrders] = useState(0)
  const [recent, setRecent] = useState<RecentEvent[]>([])

  // Refs para acceder a los últimos valores dentro de los listeners del socket
  // (que se registran UNA vez y no ven re-renders).
  const clinicIdRef = useRef<string | undefined>(undefined)
  const roleRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    clinicIdRef.current = (session?.user as any)?.clinicId
    roleRef.current = (session?.user as any)?.role
  }, [session])

  // Helper para añadir evento reciente
  const pushRecent = useCallback((ev: RecentEvent) => {
    setRecent((prev) => [ev, ...prev].slice(0, MAX_RECENT))
  }, [])

  // Conexión única al mini-servicio
  useEffect(() => {
    // No conectar si no hay sesión
    if (!session?.user) return

    // Podólogo no necesita tiempo real de Red (no tiene acceso al módulo).
    if ((session.user as any).role === 'PODOLOGIST') return

    const socket = io('/?XTransformPort=3003', {
      path: '/red-ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    })
    socketRef.current = socket

    const onConnect = () => {
      setConnected(true)
      const clinicId = clinicIdRef.current
      const role = roleRef.current
      if (clinicId || role) {
        socket.emit('join', { clinicId, role })
      }
    }
    const onDisconnect = () => setConnected(false)

    const onMessage = (p: RedPayload) => {
      // Solo cuenta si el mensaje es para MI clínica
      if (p?.toClinicId && p.toClinicId === clinicIdRef.current) {
        setUnreadMessages((n) => n + 1)
        pushRecent({
          id: p.id || `m-${Date.now()}`,
          kind: 'message',
          title: p.subject || 'Nuevo mensaje',
          subtitle: `De: ${p.fromClinic?.name || 'Clínica'}`,
          at: Date.now(),
        })
        toast.info('Nuevo mensaje en la Red', {
          description: `${p.subject || ''}${p.fromClinic?.name ? ' — ' + p.fromClinic.name : ''}`,
          icon: <Bell className="h-4 w-4" />,
        })
      }
      qc.invalidateQueries({ queryKey: ['red', 'mensajes'] })
    }

    const onNotice = (p: RedPayload) => {
      // Avisos son broadcast — todos los usuarios de Red los ven
      setUnreadNotices((n) => n + 1)
      pushRecent({
        id: p.id || `n-${Date.now()}`,
        kind: 'notice',
        title: p.title || 'Nuevo aviso',
        subtitle: p.type || 'INFO',
        at: Date.now(),
      })
      const icon =
        p.type === 'URGENTE' ? <AlertTriangle className="h-4 w-4" />
        : p.type === 'CAPACITACION' ? <GraduationCap className="h-4 w-4" />
        : <Info className="h-4 w-4" />
      const t =
        p.type === 'URGENTE' ? toast.error
        : p.type === 'CAPACITACION' ? toast.success
        : toast.info
      t(`Aviso: ${p.title || ''}`, {
        description: p.body?.slice(0, 120) || '',
        icon,
      })
      qc.invalidateQueries({ queryKey: ['red', 'avisos'] })
    }

    const onOrder = (p: RedPayload) => {
      // Cuenta si el pedido involucra a mi clínica (from o to)
      const me = clinicIdRef.current
      if (p?.fromClinicId === me || p?.toClinicId === me) {
        setUnreadOrders((n) => n + 1)
        pushRecent({
          id: p.id || `o-${Date.now()}`,
          kind: 'order',
          title: `Pedido ${p.status || 'actualizado'}`,
          subtitle: `${p.urgency === 'URGENTE' ? '🚨 ' : ''}${p.fromClinic?.name || ''} → ${p.toClinic?.name || ''}`,
          at: Date.now(),
        })
        toast.info('Actualización de pedido', {
          description: `Estado: ${p.status || '-'}${p.urgency === 'URGENTE' ? ' (URGENTE)' : ''}`,
          icon: <Package className="h-4 w-4" />,
        })
      }
      qc.invalidateQueries({ queryKey: ['red', 'pedidos'] })
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('red:message', onMessage)
    socket.on('red:notice', onNotice)
    socket.on('red:order', onOrder)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('red:message', onMessage)
      socket.off('red:notice', onNotice)
      socket.off('red:order', onOrder)
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [session, qc, pushRecent])

  // Re-join cuando cambia la sesión (poco frecuente pero defensive)
  useEffect(() => {
    if (connected && socketRef.current && session?.user) {
      const clinicId = (session.user as any).clinicId
      const role = (session.user as any).role
      if (clinicId || role) {
        socketRef.current.emit('join', { clinicId, role })
      }
    }
  }, [connected, session])

  const reset = useCallback((which: 'messages' | 'notices' | 'orders') => {
    if (which === 'messages') setUnreadMessages(0)
    if (which === 'notices') setUnreadNotices(0)
    if (which === 'orders') setUnreadOrders(0)
  }, [])

  const clearRecent = useCallback(() => setRecent([]), [])

  const value = useMemo<RedContextValue>(
    () => ({
      connected,
      unreadMessages,
      unreadNotices,
      unreadOrders,
      totalUnread: unreadMessages + unreadNotices + unreadOrders,
      reset,
      recent,
      clearRecent,
    }),
    [connected, unreadMessages, unreadNotices, unreadOrders, reset, recent, clearRecent],
  )

  return <RedContext.Provider value={value}>{children}</RedContext.Provider>
}
