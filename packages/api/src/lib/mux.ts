import { env } from "./env.js";

// ── Types ──────────────────────────────────────────────────

interface MuxLiveStreamResponse {
  streamKey: string;
  playbackId: string;
  muxStreamId: string;
}

interface MuxStreamStatus {
  muxStreamId: string;
  status: string;
  activeAssetId: string | null;
}

// ── Configuration ──────────────────────────────────────────

const MUX_API_BASE = "https://api.mux.com/video/v1";

function getMuxCredentials(): { tokenId: string; tokenSecret: string } | null {
  const tokenId = env.MUX_TOKEN_ID;
  const tokenSecret = env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    return null;
  }

  return { tokenId, tokenSecret };
}

function getMuxAuthHeader(): string {
  const creds = getMuxCredentials();
  if (!creds) {
    throw new Error("Mux credentials not configured");
  }
  const encoded = Buffer.from(`${creds.tokenId}:${creds.tokenSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

function isMuxConfigured(): boolean {
  return getMuxCredentials() !== null;
}

// ── Mock Data for Development ──────────────────────────────

let mockStreamCounter = 0;

function generateMockStream(title: string): MuxLiveStreamResponse {
  mockStreamCounter++;
  return {
    streamKey: `mock-stream-key-${mockStreamCounter}-${Date.now()}`,
    playbackId: `mock-playback-${mockStreamCounter}-${Date.now()}`,
    muxStreamId: `mock-mux-stream-${mockStreamCounter}-${Date.now()}`,
  };
}

// ── Mux API Functions ──────────────────────────────────────

/**
 * Creates a new Mux live stream.
 * Returns the stream key (for the broadcaster), playback ID (for viewers),
 * and the Mux-internal stream ID.
 *
 * If Mux credentials are not configured, returns mock data suitable for
 * development and logs a warning.
 */
export async function createLiveStream(
  title: string
): Promise<MuxLiveStreamResponse> {
  if (!isMuxConfigured()) {
    console.warn(
      "[Mux] MUX_TOKEN_ID/MUX_TOKEN_SECRET not set. Returning mock stream data for development."
    );
    return generateMockStream(title);
  }

  const response = await fetch(`${MUX_API_BASE}/live-streams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getMuxAuthHeader(),
    },
    body: JSON.stringify({
      playback_policy: ["public"],
      new_asset_settings: {
        playback_policy: ["public"],
      },
      reduced_latency: true,
      test: env.NODE_ENV !== "production",
      passthrough: title,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[Mux] Failed to create live stream (HTTP ${response.status}):`,
      errorBody
    );
    throw new Error(`Mux API error: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const stream = body.data;

  const playbackId =
    stream.playback_ids && stream.playback_ids.length > 0
      ? stream.playback_ids[0].id
      : null;

  if (!playbackId) {
    throw new Error("Mux live stream created but no playback ID was returned");
  }

  return {
    streamKey: stream.stream_key,
    playbackId,
    muxStreamId: stream.id,
  };
}

/**
 * Signals that a live stream is complete. This tells Mux to finalize
 * the stream and create an asset from it.
 */
export async function endLiveStream(muxStreamId: string): Promise<void> {
  if (!isMuxConfigured()) {
    console.warn(
      "[Mux] MUX_TOKEN_ID/MUX_TOKEN_SECRET not set. Skipping endLiveStream call for development."
    );
    return;
  }

  const response = await fetch(
    `${MUX_API_BASE}/live-streams/${muxStreamId}/complete`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: getMuxAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[Mux] Failed to end live stream ${muxStreamId} (HTTP ${response.status}):`,
      errorBody
    );
    throw new Error(`Mux API error: ${response.status} ${response.statusText}`);
  }
}

/**
 * Retrieves the current status of a Mux live stream.
 */
export async function getLiveStreamStatus(
  muxStreamId: string
): Promise<MuxStreamStatus> {
  if (!isMuxConfigured()) {
    console.warn(
      "[Mux] MUX_TOKEN_ID/MUX_TOKEN_SECRET not set. Returning mock status for development."
    );
    return {
      muxStreamId,
      status: "idle",
      activeAssetId: null,
    };
  }

  const response = await fetch(
    `${MUX_API_BASE}/live-streams/${muxStreamId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: getMuxAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[Mux] Failed to get live stream status for ${muxStreamId} (HTTP ${response.status}):`,
      errorBody
    );
    throw new Error(`Mux API error: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const stream = body.data;

  return {
    muxStreamId: stream.id,
    status: stream.status,
    activeAssetId: stream.active_asset_id ?? null,
  };
}

/**
 * Returns the HLS playback URL for viewers given a Mux playback ID.
 */
export function getPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
