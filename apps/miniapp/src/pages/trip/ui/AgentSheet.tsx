import { ScrollView, Text, View } from "@tarojs/components";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Trip } from "@/entities/trip";
import {
  approveAgentSuggestion,
  fetchAgentEvents,
  fetchAgentMessages,
  fetchAgentStatus,
  messageText,
  postAgentMessage,
  type AgentMessage,
  type AgentSuggestion,
} from "@/shared/api/agent";
import { queryKeys } from "@/shared/api/query-keys";
import { clearAgentSeedPending } from "@/shared/api/trips";
import { copy } from "@/shared/copy";
import { toastError } from "@/shared/lib/feedback";
import { flattenMarkdown } from "@/shared/lib/markdown";
import { Button, Sheet, TextField } from "@/shared/ui";

import { buildAgentSeedMessage } from "../lib/buildAgentSeedMessage";

import "./AgentSheet.scss";

const POLL_INTERVAL_MS = 2_500;

interface AgentSheetProps {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onEcho: (trip: Trip) => void;
}

/**
 * Companion chat.
 *
 * The Mini Program cannot read an SSE body incrementally, so replies arrive
 * through the cursor-based `agent/events` endpoint instead of the PWA's stream.
 */
export function AgentSheet({ open, trip, onClose, onEcho }: AgentSheetProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const cursor = useRef(0);

  const status = useQuery({
    queryKey: queryKeys.agentStatus,
    queryFn: fetchAgentStatus,
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // History and event polling 404 on every call when the agent is off, so both
  // stay quiet until the status says otherwise.
  const agentDisabled = status.data?.enabled === false;

  // Wizard intake is a suggested first prompt, never an automatic agent turn:
  // prefill the composer and let the member edit or send it (PWA parity). The
  // flag itself is cleared after the first successful send below.
  useEffect(() => {
    if (!open || agentDisabled || !trip.agentSeedPending) return;
    const seed = buildAgentSeedMessage(trip.intake);
    if (seed) setDraft((current) => current || seed);
  }, [open, agentDisabled, trip.agentSeedPending, trip.intake]);

  const absorb = useCallback(
    (incoming: AgentMessage[], nextSuggestions: AgentSuggestion[]) => {
      if (incoming.length > 0) {
        setMessages((current) => {
          const seen = new Set(current.map((message) => message.id));
          const merged = [
            ...current,
            ...incoming.filter((message) => !seen.has(message.id)),
          ];
          return merged.sort((left, right) => left.seq - right.seq);
        });
        cursor.current = Math.max(
          cursor.current,
          ...incoming.map((message) => message.seq),
        );
      }
      if (nextSuggestions.length > 0) {
        setSuggestions((current) => {
          const byId = new Map(current.map((entry) => [entry.id, entry]));
          for (const entry of nextSuggestions) byId.set(entry.id, entry);
          return [...byId.values()].filter((entry) => entry.status === "pending");
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || agentDisabled) return;
    let active = true;
    fetchAgentMessages(trip.id)
      .then((history) => {
        if (!active) return;
        setMessages(history.messages);
        setSuggestions(
          history.suggestions.filter((entry) => entry.status === "pending"),
        );
        cursor.current = history.messages.reduce(
          (latest, message) => Math.max(latest, message.seq),
          0,
        );
      })
      .catch((error: unknown) => console.error("OpenTrip agent history", error));
    return () => {
      active = false;
    };
  }, [open, trip.id, agentDisabled]);

  useEffect(() => {
    if (!open || agentDisabled) return;
    const timer = setInterval(() => {
      fetchAgentEvents(trip.id, cursor.current)
        .then((events) => absorb(events.messages, events.suggestions))
        .catch((error: unknown) => console.error("OpenTrip agent events", error));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [open, trip.id, absorb, agentDisabled]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      const { message } = await postAgentMessage(trip.id, text);
      absorb([message], []);
      if (trip.agentSeedPending) {
        // The wizard seed is one-shot: acknowledge it after the member's first
        // message, the same moment the PWA clears the flag.
        onEcho(await clearAgentSeedPending(trip.id));
      }
    } catch (error) {
      toastError(error, copy.schedule.saveFailed);
    } finally {
      setSending(false);
    }
  }

  async function decide(suggestion: AgentSuggestion, approved: boolean): Promise<void> {
    try {
      const result = await approveAgentSuggestion(trip.id, suggestion.id, approved);
      if (approved && result && "id" in result) onEcho(result as Trip);
      setSuggestions((current) =>
        current.filter((entry) => entry.id !== suggestion.id),
      );
    } catch (error) {
      toastError(error, copy.schedule.saveFailed);
    }
  }

  // System bookkeeping messages carry no text parts; the thread is empty until a
  // renderable message arrives, so the hint is keyed off the rendered set.
  const visible = messages.filter((message) => messageText(message).length > 0);

  // Follow the tail of the thread: when the visible list grows, scroll the
  // newest message into view.
  const lastMessageId = visible.length > 0 ? visible[visible.length - 1].id : "";
  const seenCount = useRef(0);
  const [scrollTarget, setScrollTarget] = useState("");
  useEffect(() => {
    if (visible.length > seenCount.current && lastMessageId) {
      setScrollTarget(`agent-message-${lastMessageId}`);
    }
    seenCount.current = visible.length;
  }, [visible.length, lastMessageId]);

  return (
    <Sheet
      open={open}
      title={copy.agent.title}
      onClose={onClose}
      footer={
        <>
          <View className="ot-agent__composer">
            <TextField
              value={draft}
              onChange={setDraft}
              placeholder={copy.agent.placeholder}
            />
          </View>
          <Button
            disabled={sending || !draft.trim() || status.data?.enabled === false}
            onClick={() => void send()}
          >
            {copy.agent.send}
          </Button>
        </>
      }
    >
      {status.data?.enabled === false ? (
        <Text className="ot-agent__notice">{copy.agent.disabled}</Text>
      ) : null}

      {suggestions.map((suggestion) => (
        <View className="ot-agent__suggestion" key={suggestion.id}>
          <Text className="ot-agent__suggestion-title">
            {copy.agent.suggestionTitle}
          </Text>
          <Text className="ot-agent__suggestion-text">
            {suggestion.suggestionText || suggestion.reason}
          </Text>
          <View className="ot-agent__suggestion-actions">
            <Button variant="ghost" size="sm" onClick={() => void decide(suggestion, false)}>
              {copy.agent.dismiss}
            </Button>
            <Button size="sm" onClick={() => void decide(suggestion, true)}>
              {copy.agent.apply}
            </Button>
          </View>
        </View>
      ))}

      <ScrollView
        className="ot-agent__thread"
        scrollY
        scrollWithAnimation
        scrollIntoView={scrollTarget}
      >
        {visible.length === 0 ? (
          <Text className="ot-agent__empty">{copy.agent.empty}</Text>
        ) : null}
        {visible.map((message) => {
          const text = flattenMarkdown(messageText(message));
          if (!text) return null;
          return (
            <View
              className={
                message.role === "assistant"
                  ? "ot-agent__message is-assistant"
                  : "ot-agent__message"
              }
              id={`agent-message-${message.id}`}
              key={message.id}
            >
              <Text className="ot-agent__message-author">
                {message.role === "assistant"
                  ? copy.agent.title
                  : message.actorName ?? ""}
              </Text>
              <Text className="ot-agent__message-text">{text}</Text>
            </View>
          );
        })}
        {sending ? (
          <Text className="ot-agent__notice">{copy.agent.thinking}</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
