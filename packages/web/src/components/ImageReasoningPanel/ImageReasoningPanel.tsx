import { useEffect, useState } from 'react';
import Send from 'lucide-react/dist/esm/icons/send';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import type { ChartConfig, ChartData } from '../../types';
import { sendChatMessage } from '../../services/chartChatService';
import './ImageReasoningPanel.css';

interface ImageReasoningPanelProps {
  data: ChartData;
  config: ChartConfig;
  onDataChange: (data: ChartData) => void;
  onConfigChange: (config: ChartConfig) => void;
}

export function ImageReasoningPanel({
  data,
  config,
  onDataChange,
  onConfigChange,
}: ImageReasoningPanelProps) {
  const [notes, setNotes] = useState(data.aiReasoning ?? '');
  const [initialNotes, setInitialNotes] = useState(data.aiReasoning ?? '');
  const [assistantReply, setAssistantReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const nextNotes = data.aiReasoning ?? '';
    setNotes(nextNotes);
    setInitialNotes(nextNotes);
    setAssistantReply(null);
    setError(null);
  }, [data.aiReasoning]);

  const isDirty = notes !== initialNotes;
  const canApply = notes.trim().length > 0 && !isLoading;

  const handleApply = async () => {
    if (!canApply) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(notes, data, config, []);
      const nextData = response.updatedData ? response.updatedData : data;
      onDataChange({ ...nextData, aiReasoning: notes });

      if (response.updatedConfig) {
        onConfigChange({ ...config, ...response.updatedConfig });
      }

      setAssistantReply(response.message);
      setInitialNotes(notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setNotes(initialNotes);
    setError(null);
    setAssistantReply(null);
  };

  return (
    <div className="image-reasoning-panel">
      <div className="image-reasoning-header">
        <span className="image-reasoning-label">RECONSTRUCTION NOTES</span>
        {isDirty && (
          <button
            className="image-reasoning-reset"
            onClick={handleReset}
            title="Reset notes"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}
      </div>
      <p className="image-reasoning-help">
        Edit the notes to correct the extraction or describe how the table should change.
        Click “Update table” to apply your instructions.
      </p>
      <textarea
        className="image-reasoning-textarea"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Describe how the table should be reconstructed from the image..."
        aria-label="Reconstruction notes"
      />
      <div className="image-reasoning-actions">
        <button
          className="image-reasoning-apply"
          onClick={handleApply}
          disabled={!canApply}
        >
          {isLoading ? <Loader2 size={14} className="image-reasoning-spin" /> : <Send size={14} />}
          {isLoading ? 'Updating...' : 'Update table'}
        </button>
        {error && <span className="image-reasoning-error">{error}</span>}
      </div>
      {assistantReply && (
        <div className="image-reasoning-reply">
          <span className="image-reasoning-reply-label">AI response</span>
          <p className="image-reasoning-reply-text">{assistantReply}</p>
        </div>
      )}
    </div>
  );
}
