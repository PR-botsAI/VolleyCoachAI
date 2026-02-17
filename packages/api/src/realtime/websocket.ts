import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { WS_EVENTS } from "@volleycoach/shared";
import type {
  LiveScoreUpdate,
  AnalysisProgressUpdate,
} from "@volleycoach/shared";

let io: SocketServer | null = null;

/**
 * Initialize the Socket.IO server and attach it to the HTTP server.
 */
export function initializeWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Join a game room to receive live score updates
    socket.on("join:game", (gameId: number) => {
      const room = `game:${gameId}`;
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room ${room}`);
    });

    // Leave a game room
    socket.on("leave:game", (gameId: number) => {
      const room = `game:${gameId}`;
      socket.leave(room);
      console.log(`[WS] ${socket.id} left room ${room}`);
    });

    // Join a live stream room
    socket.on("join:stream", (streamId: number) => {
      const room = `stream:${streamId}`;
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room ${room}`);

      // Broadcast updated viewer count
      const roomClients = io?.sockets.adapter.rooms.get(room);
      const viewerCount = roomClients ? roomClients.size : 0;
      io?.to(room).emit(WS_EVENTS.STREAM_VIEWER_COUNT, {
        streamId,
        viewerCount,
      });
    });

    // Leave a live stream room
    socket.on("leave:stream", (streamId: number) => {
      const room = `stream:${streamId}`;
      socket.leave(room);
      console.log(`[WS] ${socket.id} left room ${room}`);

      // Broadcast updated viewer count
      const roomClients = io?.sockets.adapter.rooms.get(room);
      const viewerCount = roomClients ? roomClients.size : 0;
      io?.to(room).emit(WS_EVENTS.STREAM_VIEWER_COUNT, {
        streamId,
        viewerCount,
      });
    });

    // Join an analysis progress room (per-video)
    socket.on("join:analysis", (videoId: number) => {
      const room = `analysis:${videoId}`;
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room ${room}`);
    });

    // Leave an analysis room
    socket.on("leave:analysis", (videoId: number) => {
      const room = `analysis:${videoId}`;
      socket.leave(room);
      console.log(`[WS] ${socket.id} left room ${room}`);
    });

    // Join a user-specific notification room
    socket.on("join:user", (userId: string) => {
      const room = `user:${userId}`;
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room ${room}`);
    });

    socket.on("disconnect", (reason: string) => {
      console.log(`[WS] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("[WS] Socket.IO server initialized");
  return io;
}

/**
 * Get the Socket.IO server instance.
 */
export function getIO(): SocketServer {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized. Call initializeWebSocket first."
    );
  }
  return io;
}

/**
 * Broadcast a score update to all clients watching a specific game.
 */
export function broadcastToGame(
  gameId: number,
  event: string,
  data: LiveScoreUpdate | Record<string, unknown>
): void {
  if (!io) return;
  io.to(`game:${gameId}`).emit(event, data);
}

/**
 * Broadcast an event to all clients watching a specific stream.
 */
export function broadcastToStream(
  streamId: number,
  event: string,
  data: Record<string, unknown>
): void {
  if (!io) return;
  io.to(`stream:${streamId}`).emit(event, data);
}

/**
 * Broadcast analysis progress to all clients watching a specific video analysis.
 * Supports both single-argument (AnalysisProgressUpdate) and two-argument (videoId, update) forms.
 */
export function broadcastAnalysisProgress(
  videoIdOrUpdate: number | AnalysisProgressUpdate,
  update?: AnalysisProgressUpdate
): void {
  if (!io) return;

  let progressUpdate: AnalysisProgressUpdate;
  if (typeof videoIdOrUpdate === "number") {
    progressUpdate = update!;
  } else {
    progressUpdate = videoIdOrUpdate;
  }

  io.to(`analysis:${progressUpdate.videoId}`).emit(
    WS_EVENTS.ANALYSIS_PROGRESS,
    progressUpdate
  );
}

/**
 * Send a notification to a specific user via their personal room.
 */
export function sendNotification(
  userId: string,
  notification: {
    id?: number;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }
): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(WS_EVENTS.NOTIFICATION_NEW, notification);
}

/**
 * Get the current viewer count for a stream room.
 */
export function getStreamViewerCount(streamId: number): number {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(`stream:${streamId}`);
  return room ? room.size : 0;
}
