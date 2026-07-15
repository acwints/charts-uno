import type { RefObject } from 'react';
import Save from 'lucide-react/dist/esm/icons/save';
import Check from 'lucide-react/dist/esm/icons/check';
import Plus from 'lucide-react/dist/esm/icons/plus';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Table2 from 'lucide-react/dist/esm/icons/table-2';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import { ChartPreview, type ChartLogoOption } from '../ChartPreview';
import { ChartControls } from '../ChartControls';
import { EditableSpreadsheet } from '../EditableSpreadsheet/EditableSpreadsheet';
import { ImageReasoningPanel } from '../ImageReasoningPanel/ImageReasoningPanel';
import { ReverseEngineerView } from '../ReverseEngineerView/ReverseEngineerView';
import { ExportMenu } from '../ExportMenu';
import { ShareMenu } from '../ShareMenu';
import { PublishMenu } from '../PublishMenu';
import { Button } from '../Button';
import type { ChartConfig, ChartData } from '../../types';
import type { WatermarkSettings } from '../../services/exportService';
import './ChartWorkbench.css';

export type ChartEditorView = 'chart' | 'data';

interface PublishTeamOption {
  id: string;
  name: string;
}

interface ChartWorkbenchProps {
  data: ChartData;
  config: ChartConfig;
  chartId?: string;
  chartRef: RefObject<HTMLDivElement | null>;
  editorView: ChartEditorView;
  isAuthenticated: boolean;
  isSaving: boolean;
  isDataDirty: boolean;
  isPublishedToFeed: boolean;
  publishedTeamIds: string[];
  publishTeamOptions: PublishTeamOption[];
  watermark: WatermarkSettings;
  logoOptions: ChartLogoOption[];
  logoSelectionValue: string;
  canCustomizeBranding: boolean;
  onCreateNew: () => void;
  onSave: () => void;
  onEditorViewChange: (view: ChartEditorView) => void;
  onPublishTargetsChange: (targets: { isPublic: boolean; teamIds: string[] }) => void;
  onDataChange: (data: ChartData) => void;
  onDataReset: () => void;
  onConfigChange: (config: ChartConfig) => void;
  onLogoSelectionChange: (value: string) => void;
}

function getVerificationLabel(data: ChartData): string {
  if (data.verifiedData) return 'Verified';
  if (data.sourceType === 'prompt') return 'Needs verification';
  return 'Draft';
}

function getVerificationTone(data: ChartData): 'verified' | 'warning' | 'neutral' {
  if (data.verifiedData) return 'verified';
  if (data.sourceType === 'prompt') return 'warning';
  return 'neutral';
}

export function ChartWorkbench({
  data,
  config,
  chartId,
  chartRef,
  editorView,
  isAuthenticated,
  isSaving,
  isDataDirty,
  isPublishedToFeed,
  publishedTeamIds,
  publishTeamOptions,
  watermark,
  logoOptions,
  logoSelectionValue,
  canCustomizeBranding,
  onCreateNew,
  onSave,
  onEditorViewChange,
  onPublishTargetsChange,
  onDataChange,
  onDataReset,
  onConfigChange,
  onLogoSelectionChange,
}: ChartWorkbenchProps) {
  const isImageSource = data.sourceType === 'image';
  const isPromptSource = data.sourceType === 'prompt';
  const verificationTone = getVerificationTone(data);
  const saveLabel = isSaving ? 'Saving...' : chartId ? 'Update' : 'Save';

  return (
    <>
      <div className="workbench-toolbar">
        <div className="workbench-toolbar-left">
          <Button variant="default" size="sm" onClick={onCreateNew}>
            <Plus size={16} />
            New Chart
          </Button>
          <div className="workbench-status" aria-label="Chart status">
            <span className="workbench-status-pill">{config.type}</span>
            <span className="workbench-status-pill">{data.labels.length} points</span>
            <span className="workbench-status-pill">{data.series.length} series</span>
            <span className={`workbench-status-pill workbench-status-pill--${verificationTone}`}>
              {getVerificationLabel(data)}
            </span>
          </div>
        </div>

        <div className="workbench-toolbar-center">
          <div className="workbench-view-toggle" role="group" aria-label="Editor view">
            <button
              className={`workbench-view-toggle-btn ${editorView === 'chart' ? 'is-active' : ''}`}
              onClick={() => onEditorViewChange('chart')}
              aria-label="Chart view"
              aria-pressed={editorView === 'chart'}
            >
              <BarChart3 size={14} />
              <span>Chart</span>
            </button>
            <button
              className={`workbench-view-toggle-btn ${editorView === 'data' ? 'is-active' : ''}`}
              onClick={() => onEditorViewChange('data')}
              aria-label="Data editor view"
              aria-pressed={editorView === 'data'}
            >
              <Table2 size={14} />
              <span>Data</span>
            </button>
          </div>
        </div>

        <div className="workbench-toolbar-right">
          {isAuthenticated && (
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              title={chartId ? 'Update chart' : 'Save chart'}
            >
              {chartId ? <Check size={16} /> : <Save size={16} />}
              {saveLabel}
            </Button>
          )}
          {chartId && isAuthenticated && (
            <PublishMenu
              chartId={chartId}
              isPublic={isPublishedToFeed}
              publishedTeamIds={publishedTeamIds}
              onTargetsChange={onPublishTargetsChange}
              teamOptions={publishTeamOptions}
              isAuthenticated={isAuthenticated}
            />
          )}
          {editorView === 'chart' && (
            <>
              <ExportMenu
                data={data}
                chartRef={chartRef}
                chartId={chartId}
                title={config.title}
                watermark={watermark}
                isAuthenticated={isAuthenticated}
              />
              <ShareMenu
                chartRef={chartRef}
                title={config.title}
                watermark={watermark}
                isAuthenticated={isAuthenticated}
              />
            </>
          )}
        </div>
      </div>

      {editorView === 'data' ? (
        <div className="workbench-data-editor">
          {isImageSource && (
            <div className="workbench-data-top-row">
              {data.sourceImage && (
                <div className="workbench-source-image-panel">
                  <div className="workbench-source-image-header">
                    <ImageIcon size={14} />
                    <span className="workbench-source-image-label">Source</span>
                  </div>
                  <div className="workbench-source-image-preview">
                    <img
                      src={`data:${data.sourceImage.mimeType};base64,${data.sourceImage.base64}`}
                      alt="Original chart source"
                      className="workbench-source-image-img"
                    />
                  </div>
                </div>
              )}
              <ImageReasoningPanel data={data} onDataChange={onDataChange} />
            </div>
          )}

          {isPromptSource && data.sourcePrompt && (
            <div className="workbench-prompt-source-panel">
              <div className="workbench-prompt-source-header">
                <span className="workbench-prompt-source-label">Reconstruction prompt</span>
                <span
                  className={`workbench-prompt-source-status ${data.verifiedData ? 'verified' : 'unverified'}`}
                  aria-label={data.verifiedData ? 'Verified source-backed data' : 'Unverified AI-generated data'}
                  title={data.verifiedData ? 'Verified source-backed data' : 'Unverified AI-generated data'}
                >
                  {data.verifiedData ? 'Verified data' : 'Unverified AI estimate'}
                </span>
              </div>
              <p className="workbench-prompt-source-text">{data.sourcePrompt}</p>
              {data.sources && data.sources.length > 0 && (
                <div className="workbench-prompt-source-links" aria-label="Verification sources">
                  {data.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="workbench-prompt-source-link"
                    >
                      <span>{source.title}</span>
                      <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              )}
              {!data.verifiedData && (
                <p className="workbench-prompt-source-note">
                  This chart was generated from your prompt and may contain synthetic or approximate values.
                  Verify against a trusted source before publishing as factual.
                </p>
              )}
            </div>
          )}

          <EditableSpreadsheet
            data={data}
            colorScheme={config.colorScheme}
            isDirty={isDataDirty}
            onChange={onDataChange}
            onReset={onDataReset}
          />
        </div>
      ) : isImageSource ? (
        <ReverseEngineerView
          initialData={data}
          config={config}
          onConfigChange={onConfigChange}
          chartRef={chartRef}
          watermark={watermark}
          logoOptions={logoOptions}
          logoSelectionValue={logoSelectionValue}
          canCustomizeBranding={canCustomizeBranding}
          onLogoSelectionChange={onLogoSelectionChange}
        />
      ) : (
        <div className="workbench-layout">
          <div className="workbench-preview-column" ref={chartRef}>
            {data.aiSummary && (
              <details className="workbench-ai-summary" open>
                <summary className="section-label workbench-ai-label">AI Insight</summary>
                <p className="workbench-ai-text">{data.aiSummary}</p>
              </details>
            )}
            <ChartPreview data={data} config={config} watermark={watermark} />
          </div>

          <aside className="workbench-sidebar" aria-label="Chart controls">
            <ChartControls
              config={config}
              onChange={onConfigChange}
              data={data}
              onDataChange={onDataChange}
              watermark={watermark}
              logoOptions={logoOptions}
              logoSelectionValue={logoSelectionValue}
              canCustomizeBranding={canCustomizeBranding}
              onLogoSelectionChange={onLogoSelectionChange}
            />
          </aside>
        </div>
      )}
    </>
  );
}
