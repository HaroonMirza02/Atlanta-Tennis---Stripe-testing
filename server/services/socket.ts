import { Server as SocketServer } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { env } from '../config/env.js'

let io: SocketServer | null = null

export function initSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log('Client connected to socket', socket.id)

    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id)
    })
  })

  console.log('Socket.io initialized')
}

export function broadcastStockUpdate(productId: string, availableStock: number) {
  if (io) {
    io.emit('stock_updated', { productId, availableStock })
  }
}