'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Mail, Bell, Package, Send } from 'lucide-react'
import { MessagesTab } from './_components/messages-tab'
import { NoticesTab } from './_components/notices-tab'
import { OrdersTab } from './_components/orders-tab'
import { NewMessageDialog } from './_components/new-message-dialog'
import { NewNoticeDialog } from './_components/new-notice-dialog'

export default function RedPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isSuper = user?.role === 'SUPER'
  const [msgOpen, setMsgOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Red CENPOD</h1>
          <p className="text-sm text-muted-foreground">
            Comunicación interna, avisos de Matriz y pedidos a distribuidora
          </p>
        </div>
        <div className="flex gap-2">
          {isSuper && (
            <Button variant="outline" size="sm" onClick={() => setNoticeOpen(true)}>
              <Bell className="h-4 w-4 mr-1" /> Nuevo aviso
            </Button>
          )}
          <Button size="sm" onClick={() => setMsgOpen(true)} style={{ backgroundColor: '#0a3143' }}>
            <Send className="h-4 w-4 mr-1" /> Nuevo mensaje
          </Button>
        </div>
      </div>

      <Tabs defaultValue="mensajes">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="mensajes" className="gap-1">
            <Mail className="h-3.5 w-3.5" /> Mensajes
          </TabsTrigger>
          <TabsTrigger value="avisos" className="gap-1">
            <Bell className="h-3.5 w-3.5" /> Avisos
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-1">
            <Package className="h-3.5 w-3.5" /> Pedidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensajes">
          <div className="space-y-3">
            <Tabs defaultValue="inbox">
              <TabsList>
                <TabsTrigger value="inbox">📥 Recibidos</TabsTrigger>
                <TabsTrigger value="sent">📤 Enviados</TabsTrigger>
              </TabsList>
              <TabsContent value="inbox" className="mt-3">
                <MessagesTab box="inbox" />
              </TabsContent>
              <TabsContent value="sent" className="mt-3">
                <MessagesTab box="sent" />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        <TabsContent value="avisos">
          <NoticesTab />
        </TabsContent>
        <TabsContent value="pedidos">
          <OrdersTab />
        </TabsContent>
      </Tabs>

      <NewMessageDialog open={msgOpen} onOpenChange={setMsgOpen} />
      {isSuper && <NewNoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} />}
    </div>
  )
}
