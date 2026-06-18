/**
 * Red CENPOD — Mini-servicio de tiempo real (Socket.io)
 *
 * Escucha en el puerto 3003 (hardcodeado, no env).
 *
 * Endpoints:
 *  - GET  /         → info del servicio
 *  - GET  /health   → healthcheck
 *  - POST /emit     → relay interno para que las API routes de Next.js
 *                     disparen eventos socket.io sin tener que conectar como
 *                     cliente. Body: { event, room?, broadcast?, payload }
 *
 * Socket.io:
 *  - El path interno es "/red-ws" para NO chocar con los endpoints REST
 *    anteriores. El frontend se conecta con:
 *        io("/?XTransformPort=3003", { path: "/red-ws" })
 *    El URL pasado a io() es "/?XTransformPort=3003" (path "/") y el `path`
 *    interno es /red-ws. Caddy enruta por la query XTransformPort.
 *  - El cliente emite `join` con { clinicId, role } → se une a `clinic:<id>`
 *    y `role:<role>`.
 *
 * NO toca la base de datos. Solo releva eventos.
 */
import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const PORT = 3003
const IO_PATH = '/red-ws'

const app = express()
app.use(express.json({ limit: '1mb' }))

const httpServer = createServer(app)

const io = new Server(httpServer, {
  path: IO_PATH,
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const log = (msg: string) => console.log(`[red-service] ${new Date().toISOString()} ${msg}`)

// ----- Socket.io -----
io.on('connection', (socket: Socket) => {
  log(`connected: ${socket.id}`)

  socket.on('join', (data: { clinicId?: string; role?: string }) => {
    if (data?.clinicId) {
      socket.join(`clinic:${data.clinicId}`)
      log(`${socket.id} joined clinic:${data.clinicId}`)
    }
    if (data?.role) {
      socket.join(`role:${data.role}`)
      log(`${socket.id} joined role:${data.role}`)
    }
  })

  socket.on('leave', (data: { clinicId?: string; role?: string }) => {
    if (data?.clinicId) socket.leave(`clinic:${data.clinicId}`)
    if (data?.role) socket.leave(`role:${data.role}`)
  })

  socket.on('disconnect', (reason) => {
    log(`disconnected: ${socket.id} (${reason})`)
  })

  socket.on('error', (err) => {
    log(`socket error ${socket.id}: ${(err as Error)?.message || err}`)
  })
})

// ----- HTTP interno (express) -----

app.get('/', (_req, res) => {
  res.json({
    service: 'red-service',
    status: 'ok',
    sockets: io.engine.clientsCount,
    port: PORT,
    ioPath: IO_PATH,
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, sockets: io.engine.clientsCount })
})

interface EmitBody {
  event?: string
  room?: string
  broadcast?: boolean
  payload?: unknown
}

app.post('/emit', (req, res) => {
  const body = (req.body || {}) as EmitBody
  const { event, room, broadcast, payload } = body

  if (!event) return res.status(400).json({ error: 'event required' })

  if (broadcast) {
    io.emit(event, payload)
    log(`/emit broadcast ${event}`)
    return res.json({ ok: true, mode: 'broadcast', event })
  }

  if (room) {
    io.to(room).emit(event, payload)
    log(`/emit room=${room} event=${event}`)
    return res.json({ ok: true, mode: 'room', room, event })
  }

  return res.status(400).json({ error: 'either room or broadcast:true required' })
})

// ----- Graceful shutdown -----
const shutdown = (sig: string) => {
  log(`received ${sig}, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      log('server closed')
      process.exit(0)
    })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

httpServer.listen(PORT, () => {
  log(`listening on :${PORT} (io path: ${IO_PATH})`)
})
