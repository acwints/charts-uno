import type { ChartData, ChartConfig } from '../types';
import { fetchApiJson } from './apiBase';

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

  const result = await fetchApiJson<{
    message: string;
    updatedData?: Partial<ChartData>;
    updatedConfig?: Partial<ChartConfig>;
    changes: { dataModified: boolean; configModified: boolean; summary: string };
  }>('/api/ai/chat', {
    method: 'POST',
    body: {
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
        barLayout: currentConfig.barLayout || 'vertical',
      },
      chat_history: recentHistory,
    },
  });

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
