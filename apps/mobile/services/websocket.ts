import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useAuthStore } from "../stores/auth";
import { useAppStore } from "../stores/app";
import { WS_EVENTS } from "@volleycoach/shared";
import type {
  LiveScoreUpdate,
  AnalysisProgressUpdate,
  LiveStreamInfo,
} from "@volleycoach/shared";

const WS_URL =
  Constants.expoConfig?.extra?.wsUrl ?? "http://localhost:3000";

type ScoreUpdateHandler = (update: LiveScoreUpdate) => void;
type StreamEventHandler = (stream: LiveStreamInfo) => void;
type AnalysisProgressHandler = (progress: AnalysisProgressUpdate) => void;
type ViewerCountHandler = (data: { streamId: number; count: number }) => void;
type NotificationHandler = (notification: {
  id: number;
  title: string;
  body: string;
  type: string;
}) => void;

interface EventHandlers {
  scoreUpdate: Set<ScoreUpdateHandler>;
  streamStarted: Set<StreamEventHandler>;
  streamEnded: Set<StreamEventHandler>;
  analysisProgress: Set<AnalysisProgressHandler>;
  viewerCount: Set<ViewerCountHandler>;
  notification: Set<NotificationHandler>;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private handlers: EventHandlers = {
    scoreUpdate: new Set(),
    streamStarted: new Set(),
    streamEnded: new Set(),
    analysisProgress: new Set(),
    viewerCount: new Set(),
    notification: new Set(),
  };

  connect(): void {
    const { firebaseIdToken } = useAuthStore.getState();
    if (!firebaseIdToken || this.socket?.connected) return;

    this.socket = io(WS_URL, {
      auth: { token: firebaseIdToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });

    this.socket.on("connect", () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", () => {
      // Connection lost
    });

    this.socket.on("connect_error", () => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.disconnect();
      }
    });

    // Game score events
    this.socket.on(
      WS_EVENTS.GAME_POINT_SCORED,
      (update: LiveScoreUpdate) => {
        this.handlers.scoreUpdate.forEach((handler) => handler(update));
      }
    );

    this.socket.on(WS_EVENTS.SCORE_UPDATE, (update: LiveScoreUpdate) => {
      this.handlers.scoreUpdate.forEach((handler) => handler(update));
    });

    // Stream events
    this.socket.on(WS_EVENTS.STREAM_STARTED, (stream: LiveStreamInfo) => {
      useAppStore.getState().incrementActiveStreams();
      this.handlers.streamStarted.forEach((handler) => handler(stream));
    });

    this.socket.on(WS_EVENTS.STREAM_ENDED, (stream: LiveStreamInfo) => {
      useAppStore.getState().decrementActiveStreams();
      this.handlers.streamEnded.forEach((handler) => handler(stream));
    });

    this.socket.on(
      WS_EVENTS.STREAM_VIEWER_COUNT,
      (data: { streamId: number; count: number }) => {
        this.handlers.viewerCount.forEach((handler) => handler(data));
      }
    );

    // Analysis events
    this.socket.on(
      WS_EVENTS.ANALYSIS_PROGRESS,
      (progress: AnalysisProgressUpdate) => {
        useAppStore
          .getState()
          .setUploadProgress(String(progress.videoId), progress.progress);
        this.handlers.analysisProgress.forEach((handler) =>
          handler(progress)
        );
      }
    );

    this.socket.on(
      WS_EVENTS.ANALYSIS_COMPLETE,
      (progress: AnalysisProgressUpdate) => {
        useAppStore
          .getState()
          .clearUploadProgress(String(progress.videoId));
        this.handlers.analysisProgress.forEach((handler) =>
          handler(progress)
        );
      }
    );

    // Notification events
    this.socket.on(
      WS_EVENTS.NOTIFICATION_NEW,
      (notification: {
        id: number;
        title: string;
        body: string;
        type: string;
      }) => {
        this.handlers.notification.forEach((handler) =>
          handler(notification)
        );
      }
    );
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectAttempts = 0;
  }

  // Room management
  joinGameRoom(gameId: number): void {
    this.socket?.emit("join:game", { gameId });
  }

  leaveGameRoom(gameId: number): void {
    this.socket?.emit("leave:game", { gameId });
  }

  joinStreamRoom(streamId: number): void {
    this.socket?.emit("join:stream", { streamId });
  }

  leaveStreamRoom(streamId: number): void {
    this.socket?.emit("leave:stream", { streamId });
  }

  joinAnalysisRoom(videoId: number): void {
    this.socket?.emit("join:analysis", { videoId });
  }

  leaveAnalysisRoom(videoId: number): void {
    this.socket?.emit("leave:analysis", { videoId });
  }

  // Event subscription
  onScoreUpdate(handler: ScoreUpdateHandler): () => void {
    this.handlers.scoreUpdate.add(handler);
    return () => {
      this.handlers.scoreUpdate.delete(handler);
    };
  }

  onStreamStarted(handler: StreamEventHandler): () => void {
    this.handlers.streamStarted.add(handler);
    return () => {
      this.handlers.streamStarted.delete(handler);
    };
  }

  onStreamEnded(handler: StreamEventHandler): () => void {
    this.handlers.streamEnded.add(handler);
    return () => {
      this.handlers.streamEnded.delete(handler);
    };
  }

  onAnalysisProgress(handler: AnalysisProgressHandler): () => void {
    this.handlers.analysisProgress.add(handler);
    return () => {
      this.handlers.analysisProgress.delete(handler);
    };
  }

  onViewerCount(handler: ViewerCountHandler): () => void {
    this.handlers.viewerCount.add(handler);
    return () => {
      this.handlers.viewerCount.delete(handler);
    };
  }

  onNotification(handler: NotificationHandler): () => void {
    this.handlers.notification.add(handler);
    return () => {
      this.handlers.notification.delete(handler);
    };
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const wsService = new WebSocketService();
