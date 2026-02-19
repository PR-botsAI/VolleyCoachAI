import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { api, ApiError, BASE_URL } from "../../services/api";
import { wsService } from "../../services/websocket";
import { useAppStore } from "../../stores/app";
import { AI_CONFIG } from "@volleycoach/shared/mobile";
import type { AnalysisProgressUpdate } from "@volleycoach/shared/mobile";

// ── Types ──────────────────────────────────────────────────────

interface VideoUploadProps {
  onUploadComplete: (videoId: number, gcsPath: string) => void;
  disabled?: boolean;
  className?: string;
}

interface UploadInitResponse {
  videoId: number;
  uploadUrl: string;
  gcsPath: string;
  expiresIn: number;
}

type UploadStage =
  | "idle"
  | "picking"
  | "initializing"
  | "uploading"
  | "completing"
  | "analyzing"
  | "error";

// ── Constants ──────────────────────────────────────────────────

const CHUNK_SIZE = AI_CONFIG.UPLOAD_CHUNK_SIZE_BYTES; // 20MB
const MAX_FILE_SIZE = AI_CONFIG.MAX_VIDEO_SIZE_BYTES; // 5GB
const MAX_RETRIES = AI_CONFIG.MAX_UPLOAD_RETRIES;

// ── Component ──────────────────────────────────────────────────

export function VideoUpload({
  onUploadComplete,
  disabled = false,
  className = "",
}: VideoUploadProps) {
  const [stage, setStage] = useState<UploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Refs for pause/resume and abort handling
  const isPausedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadStateRef = useRef<{
    uploadUrl: string;
    fileUri: string;
    fileSize: number;
    bytesUploaded: number;
    videoId: number;
    gcsPath: string;
  } | null>(null);

  const setUploadProgress = useAppStore((s) => s.setUploadProgress);
  const clearUploadProgress = useAppStore((s) => s.clearUploadProgress);

  // ── Analysis progress via WebSocket ──────────────────────────

  useEffect(() => {
    const unsubscribe = wsService.onAnalysisProgress(
      (update: AnalysisProgressUpdate) => {
        if (
          uploadStateRef.current &&
          update.videoId === uploadStateRef.current.videoId
        ) {
          if (update.stage === "complete") {
            setStage("idle");
            setProgress(0);
            clearUploadProgress(String(update.videoId));
          } else if (update.stage === "error") {
            setStage("error");
            setErrorMessage(update.message || "Analysis failed.");
            clearUploadProgress(String(update.videoId));
          } else {
            setStage("analyzing");
          }
        }
      }
    );

    return unsubscribe;
  }, [clearUploadProgress]);

  // ── File picker ──────────────────────────────────────────────

  const pickVideo = useCallback(async () => {
    try {
      setStage("picking");
      setErrorMessage(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: "video/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setStage("idle");
        return null;
      }

      const file = result.assets[0];

      // Validate file size
      if (file.size && file.size > MAX_FILE_SIZE) {
        setStage("error");
        setErrorMessage(
          `File is too large. Maximum size is ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(0)}GB.`
        );
        return null;
      }

      setFileName(file.name ?? "video");
      return file;
    } catch {
      setStage("error");
      setErrorMessage("Failed to pick a video file. Please try again.");
      return null;
    }
  }, []);

  // ── Chunked upload to GCS ────────────────────────────────────

  const uploadChunk = useCallback(
    async (
      uploadUrl: string,
      fileUri: string,
      start: number,
      end: number,
      totalSize: number
    ): Promise<boolean> => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          // Wait while paused
          while (isPausedRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          const controller = new AbortController();
          abortControllerRef.current = controller;

          // Read chunk from file
          const chunkData = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
            position: start,
            length: end - start,
          });

          // Convert base64 to binary for upload
          const binaryString = atob(chunkData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
              "Content-Type": "application/octet-stream",
            },
            body: bytes,
            signal: controller.signal,
          });

          abortControllerRef.current = null;

          // GCS returns 308 for incomplete uploads, 200/201 for completion
          if (
            response.status === 308 ||
            response.status === 200 ||
            response.status === 201
          ) {
            return true;
          }

          // Retry on server errors
          if (response.status >= 500) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }

          // Non-retryable error
          throw new Error(
            `Upload failed with status ${response.status}: ${response.statusText}`
          );
        } catch (err: unknown) {
          abortControllerRef.current = null;
          const error = err as Error;

          if (error.name === "AbortError") {
            return false;
          }

          if (attempt === MAX_RETRIES - 1) {
            throw error;
          }

          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return false;
    },
    []
  );

  // ── Main upload flow ─────────────────────────────────────────

  const startUpload = useCallback(async () => {
    const file = await pickVideo();
    if (!file) return;

    const fileUri = file.uri;
    const fileSize = file.size ?? 0;
    const mimeType = file.mimeType ?? "video/mp4";
    const originalName = file.name ?? "video.mp4";

    try {
      // Step 1: Initialize upload with backend
      setStage("initializing");
      setProgress(0);

      const initResponse = await api.post<UploadInitResponse>(
        "/upload/init",
        {
          filename: originalName,
          mimeType,
          fileSize,
        }
      );

      if (!initResponse.data) {
        throw new Error("Failed to initialize upload.");
      }

      const { videoId, uploadUrl, gcsPath } = initResponse.data;

      // Store state for pause/resume
      uploadStateRef.current = {
        uploadUrl,
        fileUri,
        fileSize,
        bytesUploaded: 0,
        videoId,
        gcsPath,
      };

      // Track progress in app store
      setUploadProgress(String(videoId), 0);

      // Step 2: Upload file in chunks
      setStage("uploading");
      let bytesUploaded = 0;

      while (bytesUploaded < fileSize) {
        // Check if paused
        while (isPausedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const chunkEnd = Math.min(bytesUploaded + CHUNK_SIZE, fileSize);

        const success = await uploadChunk(
          uploadUrl,
          fileUri,
          bytesUploaded,
          chunkEnd,
          fileSize
        );

        if (!success) {
          // Upload was aborted (cancelled)
          setStage("idle");
          setProgress(0);
          setFileName(null);
          clearUploadProgress(String(videoId));
          uploadStateRef.current = null;
          return;
        }

        bytesUploaded = chunkEnd;

        if (uploadStateRef.current) {
          uploadStateRef.current.bytesUploaded = bytesUploaded;
        }

        const pct = Math.round((bytesUploaded / fileSize) * 100);
        setProgress(pct);
        setUploadProgress(String(videoId), pct);
      }

      // Step 3: Notify backend that upload is complete
      setStage("completing");

      await api.post("/upload/complete", {
        videoId,
        config: { analysisType: "full" },
      });

      // Step 4: Join the WebSocket analysis room for real-time progress
      wsService.joinAnalysisRoom(videoId);

      setStage("analyzing");
      setProgress(100);

      // Fire the callback so the parent can navigate
      onUploadComplete(videoId, gcsPath);
    } catch (err: unknown) {
      const error = err as ApiError | Error;
      setStage("error");

      if (error instanceof ApiError) {
        if (error.code === "UPGRADE_REQUIRED") {
          setErrorMessage(
            "AI analysis requires a Pro or higher subscription."
          );
        } else if (error.code === "AI_LIMIT_REACHED") {
          setErrorMessage(
            "You have reached your monthly analysis limit. Upgrade for more."
          );
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage(
          error.message || "Upload failed. Please try again."
        );
      }

      // Clean up progress on error
      if (uploadStateRef.current) {
        clearUploadProgress(String(uploadStateRef.current.videoId));
      }
    }
  }, [
    pickVideo,
    uploadChunk,
    onUploadComplete,
    setUploadProgress,
    clearUploadProgress,
  ]);

  // ── Pause / Resume ──────────────────────────────────────────

  const togglePause = useCallback(() => {
    isPausedRef.current = !isPausedRef.current;
    setIsPaused(isPausedRef.current);
  }, []);

  // ── Cancel ──────────────────────────────────────────────────

  const cancelUpload = useCallback(() => {
    Alert.alert("Cancel Upload", "Are you sure you want to cancel?", [
      { text: "Continue Upload", style: "cancel" },
      {
        text: "Cancel",
        style: "destructive",
        onPress: () => {
          isPausedRef.current = false;
          setIsPaused(false);

          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          if (uploadStateRef.current) {
            clearUploadProgress(String(uploadStateRef.current.videoId));
            wsService.leaveAnalysisRoom(uploadStateRef.current.videoId);
          }

          uploadStateRef.current = null;
          setStage("idle");
          setProgress(0);
          setFileName(null);
          setErrorMessage(null);
        },
      },
    ]);
  }, [clearUploadProgress]);

  // ── Retry ───────────────────────────────────────────────────

  const retry = useCallback(() => {
    setStage("idle");
    setProgress(0);
    setErrorMessage(null);
    uploadStateRef.current = null;
    startUpload();
  }, [startUpload]);

  // ── Render: Idle state ──────────────────────────────────────

  if (stage === "idle") {
    return (
      <TouchableOpacity
        onPress={startUpload}
        disabled={disabled}
        activeOpacity={0.8}
        className={`bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-primary-300 dark:border-primary-700 p-8 items-center ${disabled ? "opacity-50" : ""} ${className}`}
      >
        <View className="w-20 h-20 bg-primary-100 dark:bg-primary-900 rounded-full items-center justify-center mb-4">
          <Ionicons name="cloud-upload-outline" size={40} color="#4F46E5" />
        </View>
        <Text className="text-lg font-bold text-gray-900 dark:text-white text-center">
          Upload Video for Analysis
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
          Select a game video to get AI-powered coaching insights
        </Text>
        <View className="mt-3 flex-row items-center">
          <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
          <Text className="text-xs text-gray-400 ml-1">
            Max 5GB, up to 15 min recommended
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Render: Error state ─────────────────────────────────────

  if (stage === "error") {
    return (
      <View
        className={`bg-white dark:bg-gray-800 rounded-2xl border-2 border-danger-300 dark:border-danger-700 p-6 items-center ${className}`}
      >
        <View className="w-16 h-16 bg-danger-100 dark:bg-danger-900 rounded-full items-center justify-center mb-3">
          <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
        </View>
        <Text className="text-base font-bold text-gray-900 dark:text-white text-center mb-1">
          Upload Failed
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          {errorMessage ?? "An unknown error occurred."}
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              setStage("idle");
              setErrorMessage(null);
            }}
            className="bg-gray-200 dark:bg-gray-700 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Dismiss
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={retry}
            className="bg-primary-600 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-sm font-semibold text-white">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Active upload / processing state ────────────────

  const stageLabels: Record<Exclude<UploadStage, "idle" | "error">, string> = {
    picking: "Selecting video...",
    initializing: "Preparing upload...",
    uploading: isPaused ? "Upload paused" : "Uploading video...",
    completing: "Finalizing upload...",
    analyzing: "AI analysis in progress...",
  };

  const stageDescriptions: Record<
    Exclude<UploadStage, "idle" | "error">,
    string
  > = {
    picking: "Choose a volleyball game video from your device",
    initializing: "Setting up a secure upload channel",
    uploading: fileName
      ? `${fileName} - ${progress}% uploaded`
      : `${progress}% uploaded`,
    completing: "Verifying upload integrity",
    analyzing: "Our AI is reviewing the footage for coaching insights",
  };

  return (
    <View
      className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <View className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-xl items-center justify-center mr-3">
          {stage === "analyzing" ? (
            <Ionicons name="sparkles" size={24} color="#F97316" />
          ) : (
            <ActivityIndicator size="small" color="#4F46E5" />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900 dark:text-white">
            {stageLabels[stage as Exclude<UploadStage, "idle" | "error">]}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {stageDescriptions[stage as Exclude<UploadStage, "idle" | "error">]}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
        <View
          className={`h-full rounded-full ${stage === "analyzing" ? "bg-secondary-500" : "bg-primary-600"}`}
          style={{ width: `${Math.max(progress, stage === "analyzing" ? 100 : 2)}%` }}
        />
      </View>

      {/* Progress text */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          {stage === "uploading" ? `${progress}%` : ""}
          {stage === "analyzing" ? "Processing..." : ""}
          {stage === "completing" ? "Almost done..." : ""}
          {stage === "initializing" || stage === "picking" ? "Starting..." : ""}
        </Text>
        {stage === "uploading" && uploadStateRef.current && (
          <Text className="text-xs text-gray-400">
            {(
              (uploadStateRef.current.bytesUploaded /
                (1024 * 1024))
            ).toFixed(0)}
            MB /{" "}
            {(
              (uploadStateRef.current.fileSize /
                (1024 * 1024))
            ).toFixed(0)}
            MB
          </Text>
        )}
      </View>

      {/* Controls */}
      {stage === "uploading" && (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={togglePause}
            className="flex-1 flex-row items-center justify-center bg-gray-100 dark:bg-gray-700 py-2.5 rounded-xl"
          >
            <Ionicons
              name={isPaused ? "play" : "pause"}
              size={16}
              color="#6B7280"
            />
            <Text className="text-sm font-semibold text-gray-600 dark:text-gray-300 ml-1.5">
              {isPaused ? "Resume" : "Pause"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={cancelUpload}
            className="flex-1 flex-row items-center justify-center bg-danger-50 dark:bg-danger-900/30 py-2.5 rounded-xl"
          >
            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
            <Text className="text-sm font-semibold text-danger-600 dark:text-danger-400 ml-1.5">
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {stage === "analyzing" && (
        <View className="flex-row items-center justify-center py-1">
          <Ionicons name="sparkles" size={14} color="#F97316" />
          <Text className="text-xs text-secondary-500 font-medium ml-1.5">
            This usually takes 2-5 minutes
          </Text>
        </View>
      )}
    </View>
  );
}
