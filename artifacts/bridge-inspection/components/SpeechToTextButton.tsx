import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
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

const BRIDGE_PROMPT =
  "Bridge field inspection note. Terms may include: spalling, delamination, corrosion, section loss, cracking, scour, settlement, abutment, pier, girder, bearing, joint, railing, deck, pile, NBI, SNBI, CS1, CS2, CS3, CS4, TxDOT, NCDOT.";

export function SpeechToTextButton({ onResult, style }: SpeechToTextButtonProps) {
  const c = useColors();
  const { openAiKey, aiRephrase } = useInspection();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErr = () => setError(null);

  const stopAndTranscribe = useCallback(
    async (rec: Audio.Recording) => {
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
        if (!uri) throw new Error("No recording URI");

        const key = openAiKey?.trim();
        if (!key) throw new Error("No OpenAI API key set. Add it in Settings → AI Transcription.");

        const formData = new FormData();
        formData.append("file", {
          uri,
          type: "audio/m4a",
          name: "recording.m4a",
        } as unknown as Blob);
        formData.append("model", "whisper-1");
        formData.append("prompt", BRIDGE_PROMPT);

        const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: formData,
        });
        if (!whisperRes.ok) {
          const body = await whisperRes.text();
          throw new Error(`Whisper error ${whisperRes.status}: ${body.slice(0, 120)}`);
        }
        const whisperJson = (await whisperRes.json()) as { text: string };
        let transcript = (whisperJson.text || "").trim();

        if (aiRephrase && transcript) {
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
                {
                  role: "system",
                  content:
                    "You are a bridge inspection assistant. Rewrite the following field note as a concise, professional inspection narrative. Preserve all technical details, measurements, and location references. Return only the improved text with no preamble.",
                },
                { role: "user", content: transcript },
              ],
            }),
          });
          if (chatRes.ok) {
            const chatJson = (await chatRes.json()) as {
              choices?: { message?: { content?: string } }[];
            };
            const rephrased = chatJson.choices?.[0]?.message?.content?.trim();
            if (rephrased) transcript = rephrased;
          }
        }

        if (transcript) onResult(transcript);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Transcription failed";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [openAiKey, aiRephrase, onResult]
  );

  const handlePress = useCallback(async () => {
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
      const msg = err instanceof Error ? err.message : "Could not start recording";
      setError(msg);
    }
  }, [busy, recording, stopAndTranscribe]);

  if (Platform.OS === "web") return null;

  const isRecording = !!recording;

  return (
    <View style={[styles.wrapper, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={busy}
        style={[
          styles.btn,
          {
            backgroundColor: isRecording
              ? "#7f1d1d"
              : busy
              ? c.muted
              : c.card,
            borderColor: isRecording
              ? "#ef4444"
              : busy
              ? c.border
              : c.border,
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
