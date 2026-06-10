import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Network from "expo-network";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useInspection } from "@/context/InspectionContext";

interface SpeechToTextButtonProps {
  onResult: (text: string) => void;
  style?: object;
}

const MAX_RECORD_MS = 60000;

const WHISPER_PROMPT =
  "Bridge field inspection note. Terms may include: spalling, delamination, corrosion, section loss, cracking, scour, settlement, abutment, pier, girder, bearing, joint, railing, deck, pile, NBI, SNBI, CS1, CS2, CS3, CS4, TxDOT, NCDOT.";

const GPT_SYSTEM_PROMPT =
  "You are a bridge inspection assistant. Rewrite the following field note as a concise, professional inspection narrative using this exact format: \"Location: [location reference]. [Defect description with measurements and severity in one or two sentences].\" Location must come first. Preserve all technical details, measurements, and location references. Return only the formatted text with no preamble or extra commentary.";

export function SpeechToTextButton({ onResult, style }: SpeechToTextButtonProps) {
  const c = useColors();
  const { openAiKey, aiRephrase } = useInspection();
  const networkState = Network.useNetworkState();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErr = () => setError(null);

  const isOnline = networkState.isConnected === true && networkState.isInternetReachable !== false;

  if (Platform.OS === "web") return null;
  if (!openAiKey?.trim()) return null;
  if (!isOnline) return null;

  const stopAndTranscribe = async (rec: Audio.Recording) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setRecording(null);
    setBusy(true);
    setError(null);
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) throw new Error("No recording URI.");

      const key = openAiKey.trim();

      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as unknown as Blob);
      formData.append("model", "whisper-1");
      formData.append("prompt", WHISPER_PROMPT);

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: formData,
      });
      if (!whisperRes.ok) {
        const body = await whisperRes.text();
        throw new Error(`Whisper ${whisperRes.status}: ${body.slice(0, 100)}`);
      }
      const whisperJson = (await whisperRes.json()) as { text: string };
      let transcript = (whisperJson.text || "").trim();
      if (!transcript) throw new Error("Transcription returned empty text.");

      if (aiRephrase) {
        const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 256,
            messages: [
              { role: "system", content: GPT_SYSTEM_PROMPT },
              { role: "user", content: transcript },
            ],
          }),
        });
        if (!chatRes.ok) {
          const body = await chatRes.text();
          throw new Error(`AI Rephrasing failed (${chatRes.status}): ${body.slice(0, 100)}`);
        }
        const chatJson = (await chatRes.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const rephrased = chatJson.choices?.[0]?.message?.content?.trim();
        if (!rephrased) throw new Error("AI Rephrasing returned empty response.");
        transcript = rephrased;
      }

      onResult(transcript);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transcription failed.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handlePress = async () => {
    if (busy) return;
    clearErr();

    if (recording) {
      await stopAndTranscribe(recording);
      return;
    }

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone permission denied.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      timeoutRef.current = setTimeout(() => {
        stopAndTranscribe(rec);
      }, MAX_RECORD_MS);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start recording.";
      setError(msg);
    }
  };

  const isRecording = !!recording;

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={busy}
        style={[
          styles.btn,
          {
            backgroundColor: isRecording ? "#7f1d1d" : busy ? c.muted : c.card,
            borderColor: isRecording ? "#ef4444" : c.border,
          },
        ]}
        accessibilityLabel={isRecording ? "Stop recording" : "Dictate note"}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#38bdf8" />
        ) : (
          <Feather
            name={isRecording ? "square" : "mic"}
            size={15}
            color={isRecording ? "#fca5a5" : c.mutedForeground}
          />
        )}
      </TouchableOpacity>
      {error ? (
        <Text style={styles.error} numberOfLines={2} onPress={clearErr}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "flex-end",
    gap: 4,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 10,
    color: "#f87171",
    maxWidth: 180,
    textAlign: "right",
    lineHeight: 14,
  },
});
