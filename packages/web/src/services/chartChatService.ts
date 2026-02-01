import type { ChartData, ChartConfig } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  changes?: {
    dataModified: boolean;
    configModified: boolean;
    summary: string;
  };
}

export interface ChatResponse {
  message: string;
  updatedData?: ChartData;
  updatedConfig?: Partial<ChartConfig>;
  changes: {
    dataModified: boolean;
    configModified: boolean;
    summary: string;
  };
}

export async function sendChatMessage(
  userMessage: string,
  currentData: ChartData,
  currentConfig: ChartConfig,
  chatHistory: ChatMessage[]
): Promise<ChatResponse> {
  const recentHistory = chatHistory.slice(-6).map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      message: userMessage,
      current_data: {
        labels: currentData.labels,
        series: currentData.series,
        suggestedType: currentData.suggestedType,
        suggestedTitle: currentData.suggestedTitle,
        aiReasoning: currentData.aiReasoning,
      },
      current_config: {
        type: currentConfig.type,
        colorScheme: currentConfig.colorScheme,
        styleVariant: currentConfig.styleVariant,
        showGrid: currentConfig.showGrid,
        showLegend: currentConfig.showLegend,
        showValues: currentConfig.showValues,
        animate: currentConfig.animate,
        title: currentConfig.title,
      },
      chat_history: recentHistory,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Chat request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  const result = await response.json();

  return {
    message: result.message,
    updatedData: result.updatedData ? {
      ...currentData,
      ...result.updatedData,
    } : undefined,
    updatedConfig: result.updatedConfig || undefined,
    changes: result.changes,
  };
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
