"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { EffortPicker, ModelPicker } from "@/components/model-picker";
import type { ChatModel, Effort } from "@/lib/chat-catalog";

// Chat ohne Speicherung: Nachrichten leben nur im Browser-State.
export function Chat({ models }: { models: ChatModel[] }) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  // Stufe je Modell getrennt, Standard Mittel (falls vorhanden).
  const [efforts, setEfforts] = useState<Record<string, Effort>>({});
  const { messages, sendMessage, status, stop } = useChat();

  const model = models.find((m) => m.id === modelId);
  const levels = model?.efforts ?? [];
  const effort =
    (model && efforts[model.id]) ||
    (levels.includes("medium") ? "medium" : levels[0]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Noch keine Nachrichten"
              description="Stell eine Frage, um zu starten."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) =>
                    part.type === "text" ? (
                      <MessageResponse key={`${message.id}-${i}`}>
                        {part.text}
                      </MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="px-4 pt-2 pb-4">
        <PromptInput
          className="mx-auto w-full max-w-3xl"
          onSubmit={({ text }) => {
            if (text.trim() && model)
              sendMessage({ text }, { body: { model: model.id, effort } });
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Was möchtest du wissen?" />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <ModelPicker models={models} modelId={modelId} onModelChange={setModelId} />
              {model && effort && (
                <EffortPicker
                  model={model}
                  effort={effort as Effort}
                  onEffortChange={(e) => setEfforts((s) => ({ ...s, [model.id]: e }))}
                />
              )}
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} disabled={!model} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
