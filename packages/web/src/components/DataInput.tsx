import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import Upload from 'lucide-react/dist/esm/icons/upload';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import Image from 'lucide-react/dist/esm/icons/image';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import Clipboard from 'lucide-react/dist/esm/icons/clipboard';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import DatabaseIcon from 'lucide-react/dist/esm/icons/database';
import ServerIcon from 'lucide-react/dist/esm/icons/server';
import Search from 'lucide-react/dist/esm/icons/search';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import X from 'lucide-react/dist/esm/icons/x';
import Plus from 'lucide-react/dist/esm/icons/plus';
import type { ChartData } from '../types';
import { analyzeImage } from '../services/imageAnalysis';
import { generateChartFromPrompt } from '../services/promptGenerate';
import { searchTickers, fetchStockData, fetchStockInsights, type TickerResult } from '../services/stockService';
import { getPublicDatasets, generateChartFromPublicDataset, type PublicDatasetOption } from '../services/publicDatasets';
import { useAuth } from '../hooks/useAuth';
import { AIProcessingIndicator } from './AIProcessingIndicator';
import { SqlDataInput } from './SqlDataInput';
import { Button } from './Button';
import './DataInput.css';

type InputMode = 'upload' | 'paste' | 'image' | 'sheets' | 'stocks' | 'datasets' | 'sql';

const STOCK_RANGES = ['1W', '1M', '3M', '6M', '1Y', 'YTD'] as const;

interface DataInputProps {
  onSubmit: (data: ChartData) => void;
  isProcessing: boolean;
}

const INPUT_MODES = [
  { id: 'upload' as const, icon: FileSpreadsheet, label: 'Upload CSV' },
  { id: 'paste' as const, icon: Clipboard, label: 'Paste/Describe Data' },
  { id: 'image' as const, icon: Image, label: 'Upload Image' },
  { id: 'sheets' as const, icon: Link2, label: 'Google Sheets' },
  { id: 'stocks' as const, icon: TrendingUp, label: 'Stocks' },
  { id: 'datasets' as const, icon: DatabaseIcon, label: 'Public Datasets' },
  { id: 'sql' as const, icon: ServerIcon, label: 'Database', authRequired: true },
] as const;

function splitLikelyTiedLabels(data: ChartData, rawInput: string): ChartData {
  const tieHintPattern = /(^|\n)\s*(?:t\d+|tie\s*\d+|tied)\b/i;
  if (!tieHintPattern.test(rawInput)) return data;
  if (data.labels.length === 0 || data.series.length === 0) return data;

  const splitPattern = /\s+(?:&|and)\s+/i;
  let changed = false;

  const expandedLabels: string[] = [];
  const expandedSeriesData = data.series.map(() => [] as Array<number | null>);
  const expandedSeriesConfidence = data.series.map((series) =>
    series.confidence ? [] as Array<number | null> : undefined
  );

  data.labels.forEach((originalLabel, rowIndex) => {
    const normalizedLabel = originalLabel.replace(/\s+/g, ' ').trim();
    const parts = normalizedLabel.split(splitPattern).map((part) => part.trim()).filter(Boolean);
    const shouldSplit = parts.length === 2 && parts[0] !== parts[1];
    const rowLabels = shouldSplit ? parts : [normalizedLabel];
    if (shouldSplit) changed = true;

    rowLabels.forEach((rowLabel) => {
      expandedLabels.push(rowLabel);
      data.series.forEach((series, seriesIndex) => {
        expandedSeriesData[seriesIndex].push(series.data[rowIndex] ?? null);
        if (expandedSeriesConfidence[seriesIndex]) {
          expandedSeriesConfidence[seriesIndex].push(series.confidence?.[rowIndex] ?? null);
        }
      });
    });
  });

  if (!changed) return data;

  return {
    ...data,
    labels: expandedLabels,
    series: data.series.map((series, index) => ({
      ...series,
      data: expandedSeriesData[index],
      confidence: expandedSeriesConfidence[index],
    })),
  };
}

export function DataInput({ onSubmit, isProcessing }: DataInputProps) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<InputMode>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [isPromptPanelOpen, setIsPromptPanelOpen] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tickerQuery, setTickerQuery] = useState('');
  const [tickerResults, setTickerResults] = useState<TickerResult[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [stockRange, setStockRange] = useState('3M');
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  // Second ticker for comparison (optional)
  const [ticker2Query, setTicker2Query] = useState('');
  const [ticker2Results, setTicker2Results] = useState<TickerResult[]>([]);
  const [selectedTicker2, setSelectedTicker2] = useState<string | null>(null);
  const [showTicker2Dropdown, setShowTicker2Dropdown] = useState(false);
  const [publicDatasets, setPublicDatasets] = useState<PublicDatasetOption[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasetPrompt, setDatasetPrompt] = useState('');
  const [datasetTopN, setDatasetTopN] = useState(20);
  const [datasetChartTypeHint, setDatasetChartTypeHint] = useState<'auto' | 'line' | 'bar' | 'area' | 'table'>('auto');
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isGeneratingDatasetChart, setIsGeneratingDatasetChart] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const tickerDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ticker2DebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tickerWrapperRef = useRef<HTMLDivElement>(null);
  const ticker2WrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Stage a file for upload/image without processing it
  const stageFile = useCallback((file: File) => {
    setError(null);
    setStagedFile(file);
    setFileName(file.name);

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImagePreviewUrl(null);
    }
  }, []);

  // Clean up preview URL when mode changes or component unmounts
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Close ticker dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tickerWrapperRef.current && !tickerWrapperRef.current.contains(e.target as Node)) {
        setShowTickerDropdown(false);
      }
      if (ticker2WrapperRef.current && !ticker2WrapperRef.current.contains(e.target as Node)) {
        setShowTicker2Dropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTickerSearch = useCallback((query: string) => {
    setTickerQuery(query);
    setSelectedTicker(null);

    if (tickerDebounceRef.current) {
      clearTimeout(tickerDebounceRef.current);
    }

    if (!query.trim()) {
      setTickerResults([]);
      setShowTickerDropdown(false);
      return;
    }

    tickerDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchTickers(query.trim());
        setTickerResults(results);
        setShowTickerDropdown(results.length > 0);
      } catch {
        setTickerResults([]);
        setShowTickerDropdown(false);
      }
    }, 300);
  }, []);

  const handleTickerSelect = useCallback((symbol: string) => {
    setSelectedTicker(symbol);
    setTickerQuery(symbol);
    setShowTickerDropdown(false);
    setTickerResults([]);
  }, []);

  // Second ticker handlers
  const handleTicker2Search = useCallback((query: string) => {
    setTicker2Query(query);
    setSelectedTicker2(null);

    if (ticker2DebounceRef.current) {
      clearTimeout(ticker2DebounceRef.current);
    }

    if (!query.trim()) {
      setTicker2Results([]);
      setShowTicker2Dropdown(false);
      return;
    }

    ticker2DebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchTickers(query.trim());
        setTicker2Results(results);
        setShowTicker2Dropdown(results.length > 0);
      } catch {
        setTicker2Results([]);
        setShowTicker2Dropdown(false);
      }
    }, 300);
  }, []);

  const handleTicker2Select = useCallback((symbol: string) => {
    setSelectedTicker2(symbol);
    setTicker2Query(symbol);
    setShowTicker2Dropdown(false);
    setTicker2Results([]);
  }, []);

  const clearTicker2 = useCallback(() => {
    setSelectedTicker2(null);
    setTicker2Query('');
    setTicker2Results([]);
    setShowTicker2Dropdown(false);
  }, []);

  const handleStockSubmit = useCallback(async () => {
    if (!selectedTicker) return;
    setError(null);
    setIsLoadingStock(true);
    const optionalInstructions = userPrompt.trim() || undefined;

    try {
      const data = await fetchStockData(selectedTicker, stockRange, selectedTicker2 || undefined);
      // Show chart immediately
      onSubmit({ ...data, userPrompt: optionalInstructions });

      // Fetch insights in background
      fetchStockInsights(data.labels, data.series, data.suggestedTitle || '')
        .then((insight) => {
          // Update with insights when ready
          onSubmit({ ...data, aiReasoning: insight, userPrompt: optionalInstructions });
        })
        .catch(() => {
          // Silently ignore insight failures - chart still works
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setIsLoadingStock(false);
    }
  }, [selectedTicker, selectedTicker2, stockRange, onSubmit, userPrompt]);

  const parseCSVData = useCallback((
    content: string,
    sourceType: 'csv' | 'paste',
    options?: { suppressErrors?: boolean },
  ): ChartData | null => {
    const suppressErrors = options?.suppressErrors === true;
    const result = Papa.parse(content, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (result.errors.length > 0) {
      if (!suppressErrors) {
        setError('Unable to parse data. Please check the format.');
      }
      return null;
    }

    const rows = result.data as (string | number)[][];
    if (rows.length < 2) {
      if (!suppressErrors) {
        setError('Data must have at least a header row and one data row.');
      }
      return null;
    }

    const headers = rows[0].map((header) => String(header).trim());
    if (headers.length < 2) {
      if (!suppressErrors) {
        setError('Data must include at least two columns.');
      }
      return null;
    }

    const toNumber = (value: unknown): number | null => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value !== 'string') {
        return null;
      }
      const normalized = String(value).replace(/,/g, '').trim();
      if (!normalized) return null;
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const hasNumericValue = rows.slice(1).some((row) =>
      row.slice(1).some((value) => toNumber(value) !== null),
    );

    if (!hasNumericValue) {
      if (!suppressErrors) {
        setError('Unable to detect numeric values in the pasted data.');
      }
      return null;
    }

    const labels = rows.slice(1).map(row => String(row[0]));
    const xAxisLabel = headers[0] || undefined;

    const series = headers.slice(1).map((name, colIndex) => ({
      name: name || `Series ${colIndex + 1}`,
      data: rows.slice(1).map(row => {
        const numericValue = toNumber(row[colIndex + 1]);
        return numericValue ?? 0;
      }),
    }));

    return { labels, series, sourceType, xAxisLabel, userPrompt: userPrompt.trim() || undefined };
  }, [userPrompt]);

  const handleFileUpload = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const data = parseCSVData(content, 'csv');
      if (data) {
        onSubmit(data);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, [parseCSVData, onSubmit]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleImageUpload = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setIsAnalyzing(true);

    try {
      const data = await analyzeImage(file);
      onSubmit({ ...data, userPrompt: userPrompt.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
      setFileName(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onSubmit, userPrompt]);

  // Handle Ctrl+V paste for images in image mode
  useEffect(() => {
    if (mode !== 'image') return;

    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            stageFile(file);
          }
          return;
        }
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [mode, stageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      if (mode === 'image') {
        if (file.type.startsWith('image/')) {
          stageFile(file);
        } else {
          setError('Please upload an image file.');
        }
      } else {
        if (file.name.endsWith('.csv') || file.type === 'text/csv') {
          stageFile(file);
        } else {
          setError('Please upload a CSV file.');
        }
      }
    }
  }, [mode, stageFile]);

  const looksLikeTabularData = useCallback((content: string): boolean => {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return false;
    }

    const delimiters = [',', '\t', ';', '|'];
    return delimiters.some((delimiter) => {
      const counts = lines.slice(0, 5).map((line) => line.split(delimiter).length - 1);
      const positiveCounts = counts.filter((count) => count > 0);
      if (positiveCounts.length < 2) {
        return false;
      }

      const expectedCount = positiveCounts[0];
      return positiveCounts.every((count) => count === expectedCount);
    });
  }, []);

  const handlePasteOrDescribeSubmit = useCallback(async () => {
    setError(null);
    const input = pasteContent.trim();
    const optionalInstructions = userPrompt.trim();
    if (!input) {
      setError('Please paste data or describe the chart you want to create.');
      return;
    }

    const shouldAttemptParse = looksLikeTabularData(input);
    if (shouldAttemptParse) {
      const parsedData = parseCSVData(input, 'paste', { suppressErrors: true });
      if (parsedData) {
        onSubmit(parsedData);
        return;
      }
    }

    setIsGeneratingPrompt(true);
    try {
      const promptForGeneration = optionalInstructions
        ? `${input}\n\nAdditional chart instructions:\n${optionalInstructions}`
        : input;
      const generatedData = await generateChartFromPrompt(promptForGeneration);
      const normalizedData = splitLikelyTiedLabels(generatedData, input);
      onSubmit({
        ...normalizedData,
        userPrompt: optionalInstructions || undefined,
        sourcePrompt: input,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart');
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [pasteContent, userPrompt, looksLikeTabularData, parseCSVData, onSubmit]);

  const handleSheetsSubmit = useCallback(() => {
    setError(null);
    if (!sheetsUrl.trim()) {
      setError('Please enter a Google Sheets URL.');
      return;
    }

    // Simulate sheets fetch
    setTimeout(() => {
      const demoData: ChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [
          { name: 'Users', data: [1200, 1900, 3000, 5000, 4200, 6100] },
          { name: 'Sessions', data: [2400, 3800, 6500, 9800, 8200, 11500] },
        ],
        sourceType: 'sheets',
        userPrompt: userPrompt.trim() || undefined,
      };
      onSubmit(demoData);
    }, 1200);
  }, [sheetsUrl, onSubmit, userPrompt]);

  useEffect(() => {
    if (mode !== 'datasets' || publicDatasets.length > 0 || isLoadingDatasets) return;
    setIsLoadingDatasets(true);
    getPublicDatasets()
      .then((datasets) => {
        setPublicDatasets(datasets);
        if (datasets.length > 0) {
          setSelectedDatasetId(datasets[0].id);
          if (!datasetPrompt.trim() && datasets[0].examplePrompts?.[0]) {
            setDatasetPrompt(datasets[0].examplePrompts[0]);
          }
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load public datasets');
      })
      .finally(() => setIsLoadingDatasets(false));
  }, [mode, publicDatasets.length, isLoadingDatasets, datasetPrompt]);

  const selectedDataset = publicDatasets.find((d) => d.id === selectedDatasetId) || null;

  const handlePublicDatasetSubmit = useCallback(async () => {
    setError(null);
    const optionalInstructions = userPrompt.trim();
    if (!selectedDatasetId) {
      setError('Please choose a dataset.');
      return;
    }
    if (!datasetPrompt.trim()) {
      setError('Please describe what you want to chart from this dataset.');
      return;
    }
    setIsGeneratingDatasetChart(true);
    try {
      const combinedPrompt = optionalInstructions
        ? `${datasetPrompt.trim()}\n\nAdditional chart instructions:\n${optionalInstructions}`
        : datasetPrompt.trim();
      const data = await generateChartFromPublicDataset({
        datasetId: selectedDatasetId,
        prompt: combinedPrompt,
        topN: datasetTopN,
        chartTypeHint: datasetChartTypeHint,
      });
      onSubmit({ ...data, userPrompt: optionalInstructions || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart from dataset');
    } finally {
      setIsGeneratingDatasetChart(false);
    }
  }, [selectedDatasetId, datasetPrompt, datasetTopN, datasetChartTypeHint, onSubmit, userPrompt]);

  return (
    <div className={`data-input ${isPromptPanelOpen ? 'data-input--instructions-open' : 'data-input--instructions-collapsed'}`}>
      <div className="input-mode-tabs">
        {INPUT_MODES.filter((m) => !('authRequired' in m && m.authRequired) || isAuthenticated).map((inputMode) => (
          <button
            key={inputMode.id}
            className={`mode-tab ${mode === inputMode.id ? 'active' : ''}`}
            onClick={() => {
              setMode(inputMode.id);
              setError(null);
              setFileName(null);
              setStagedFile(null);
              if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
                setImagePreviewUrl(null);
              }
            }}
          >
            <inputMode.icon size={18} />
            <span>{inputMode.label}</span>
          </button>
        ))}
      </div>

      <div className="input-content-shell">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="input-content"
          >
          {(mode === 'upload' || mode === 'image') && (
            <div className="file-input-section">
              {(isProcessing || isAnalyzing) && (
                <div className="file-input-overlay" aria-busy="true" aria-live="polite">
                  <AIProcessingIndicator
                    size="sm"
                    label={mode === 'image' ? 'Analyzing your image...' : 'Processing your data...'}
                    hint={mode === 'image' ? 'Extracting data with GPT-4o Vision' : undefined}
                    statusMessages={mode === 'image'
                      ? ['Reading chart elements...', 'Extracting data points...', 'Identifying patterns...', 'Building your chart...']
                      : ['Parsing columns...', 'Detecting data types...', 'Choosing the best chart...', 'Almost ready...']
                    }
                  />
                </div>
              )}
              <div
                className={`drop-zone ${dragActive ? 'active' : ''} ${stagedFile ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => !(isProcessing || isAnalyzing) && (mode === 'image' ? imageInputRef.current?.click() : fileInputRef.current?.click())}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && stageFile(e.target.files[0])}
                  hidden
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && stageFile(e.target.files[0])}
                  hidden
                />

                {stagedFile ? (
                  <div className="drop-zone-staged">
                    {imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Staged upload" className="drop-zone-preview-img" />
                    ) : (
                      <Check size={32} />
                    )}
                    <span className="drop-zone-staged-name">{fileName}</span>
                    <span className="drop-zone-hint">Click to choose a different file</span>
                  </div>
                ) : (
                  <>
                    <div className="drop-zone-icon">
                      {mode === 'image' ? <Image size={40} /> : <Upload size={40} />}
                    </div>
                    <p className="drop-zone-text">
                      {mode === 'image'
                        ? 'Drop an image, click to upload, or paste from clipboard'
                        : 'Drop your CSV file here or click to upload'
                      }
                    </p>
                    <span className="drop-zone-hint">
                      {mode === 'image'
                        ? 'Supports PNG, JPG, WebP — or just Ctrl+V'
                        : 'Supports .csv files up to 10MB'
                      }
                    </span>
                  </>
                )}
              </div>

              {!(isProcessing || isAnalyzing) && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    if (!stagedFile) return;
                    if (mode === 'image') {
                      handleImageUpload(stagedFile);
                    } else {
                      handleFileUpload(stagedFile);
                    }
                  }}
                  disabled={!stagedFile}
                >
                  <span>Generate Chart</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

          {mode === 'paste' && (
            <div className="paste-input">
              {(isProcessing || isGeneratingPrompt) && (
                <div className="input-processing-overlay" aria-busy="true" aria-live="polite">
                  <AIProcessingIndicator
                    size="sm"
                    label="Generating your chart..."
                    statusMessages={['Checking for structured data...', 'Converting or generating values...', 'Selecting chart type...', 'Almost ready...']}
                  />
                </div>
              )}
              <textarea
                className="paste-textarea"
                placeholder={`Paste tabular data or describe the chart you want...\n\nData example:\nCategory,Sales,Profit\nJan,1200,400\nFeb,1900,520\nMar,3000,890\n\nPrompt example:\n"Monthly revenue for a SaaS startup growing 15% month-over-month"`}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                spellCheck={false}
              />
              {!(isProcessing || isGeneratingPrompt) && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handlePasteOrDescribeSubmit}
                  disabled={!pasteContent.trim()}
                >
                  <Sparkles size={18} />
                  <span>Generate Chart</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

          {mode === 'sheets' && (
            <div className="sheets-input">
              {isProcessing && (
                <div className="input-processing-overlay" aria-busy="true" aria-live="polite">
                  <AIProcessingIndicator
                    size="sm"
                    label="Importing & generating..."
                    statusMessages={['Fetching spreadsheet...', 'Parsing data...', 'Selecting chart type...', 'Almost ready...']}
                  />
                </div>
              )}
              <div className="sheets-input-top">
                <div className="sheets-url-wrapper">
                  <Link2 size={20} className="sheets-url-icon" />
                  <input
                    type="url"
                    className="sheets-url-input"
                    placeholder="Paste your Google Sheets URL"
                    value={sheetsUrl}
                    onChange={(e) => setSheetsUrl(e.target.value)}
                  />
                </div>
                <p className="sheets-hint">
                  Make sure your sheet is publicly accessible or shared with view permissions.
                </p>
              </div>
              {!isProcessing && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSheetsSubmit}
                  disabled={!sheetsUrl.trim()}
                >
                  <span>Import & Generate</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

          {mode === 'stocks' && (
            <div className="stocks-input">
              {(isProcessing || isLoadingStock) && (
                <div className="input-processing-overlay" aria-busy="true" aria-live="polite">
                  <AIProcessingIndicator
                    size="sm"
                    label="Fetching stock data..."
                    statusMessages={['Connecting to market data...', 'Downloading price history...', 'Building your chart...', 'Almost ready...']}
                  />
                </div>
              )}
              <div className="stocks-input-top">
                <div className="stocks-col-left">
                  <div className="stocks-ticker-row" ref={tickerWrapperRef}>
                    <div className="stocks-ticker-wrapper">
                      <Search size={20} className="stocks-ticker-icon" />
                      <input
                        type="text"
                        className="stocks-ticker-input"
                        placeholder="Search for a ticker (e.g. AAPL)"
                        value={tickerQuery}
                        onChange={(e) => handleTickerSearch(e.target.value)}
                        spellCheck={false}
                        aria-label="Search ticker symbol"
                      />
                    </div>
                    {showTickerDropdown && tickerResults.length > 0 && (
                      <div className="stocks-dropdown">
                        {tickerResults.map((result) => (
                          <button
                            key={result.symbol}
                            className="stocks-dropdown-item"
                            onClick={() => handleTickerSelect(result.symbol)}
                          >
                            <span className="stocks-dropdown-symbol">{result.symbol}</span>
                            <span className="stocks-dropdown-desc">{result.description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Second ticker - optional comparison */}
                  {selectedTicker && (
                    <div className="stocks-ticker-row stocks-ticker-row--compare" ref={ticker2WrapperRef}>
                      {selectedTicker2 ? (
                        <div className="stocks-ticker-selected">
                          <span className="stocks-ticker-selected-label">vs</span>
                          <span className="stocks-ticker-selected-symbol">{selectedTicker2}</span>
                          <button
                            className="stocks-ticker-clear"
                            onClick={clearTicker2}
                            aria-label="Remove comparison ticker"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="stocks-ticker-wrapper stocks-ticker-wrapper--compare">
                            <Plus size={18} className="stocks-ticker-icon stocks-ticker-icon--muted" />
                            <input
                              type="text"
                              className="stocks-ticker-input"
                              placeholder="Compare with another stock (optional)"
                              value={ticker2Query}
                              onChange={(e) => handleTicker2Search(e.target.value)}
                              spellCheck={false}
                              aria-label="Search comparison ticker"
                            />
                          </div>
                          {showTicker2Dropdown && ticker2Results.length > 0 && (
                            <div className="stocks-dropdown">
                              {ticker2Results.map((result) => (
                                <button
                                  key={result.symbol}
                                  className="stocks-dropdown-item"
                                  onClick={() => handleTicker2Select(result.symbol)}
                                >
                                  <span className="stocks-dropdown-symbol">{result.symbol}</span>
                                  <span className="stocks-dropdown-desc">{result.description}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="stocks-range-bar">
                  {STOCK_RANGES.map((range) => (
                    <button
                      key={range}
                      className={`stocks-range-btn ${stockRange === range ? 'active' : ''}`}
                      onClick={() => setStockRange(range)}
                      aria-pressed={stockRange === range}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {!(isProcessing || isLoadingStock) && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleStockSubmit}
                  disabled={!selectedTicker}
                >
                  <TrendingUp size={18} />
                  <span>{selectedTicker2 ? 'Compare Stocks' : 'Chart Stock'}</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

            {mode === 'datasets' && (
              <div className="datasets-input">
              {(isProcessing || isGeneratingDatasetChart || isLoadingDatasets) && (
                <div className="datasets-input-overlay" aria-busy="true" aria-live="polite">
                  <AIProcessingIndicator
                    size="sm"
                    label={isLoadingDatasets ? 'Loading datasets...' : 'Querying public dataset...'}
                    statusMessages={['Building SQL query...', 'Running BigQuery...', 'Formatting chart data...', 'Almost ready...']}
                  />
                </div>
              )}
              <div className="datasets-input-top">
                <div className="datasets-select-wrapper">
                  <DatabaseIcon size={18} className="datasets-select-icon" />
                  <select
                    className="datasets-select"
                    value={selectedDatasetId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedDatasetId(nextId);
                      const next = publicDatasets.find((d) => d.id === nextId);
                      if (next && !datasetPrompt.trim() && next.examplePrompts?.[0]) {
                        setDatasetPrompt(next.examplePrompts[0]);
                      }
                    }}
                    disabled={isLoadingDatasets || publicDatasets.length === 0}
                    aria-label="Select a public dataset"
                  >
                    {publicDatasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedDataset && (
                  <div className="datasets-meta">
                    <p className="datasets-description">{selectedDataset.description}</p>
                    {selectedDataset.examplePrompts.length > 0 && (
                      <div className="datasets-examples">
                        {selectedDataset.examplePrompts.slice(0, 3).map((example) => (
                          <button
                            key={example}
                            className="datasets-example-chip"
                            type="button"
                            onClick={() => setDatasetPrompt(example)}
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <textarea
                  className="datasets-prompt-textarea"
                  placeholder="Describe what to chart from the selected dataset (e.g., 'average rating by year since 2000')"
                  value={datasetPrompt}
                  onChange={(e) => setDatasetPrompt(e.target.value)}
                  spellCheck={false}
                />
                <div className="datasets-controls-row">
                  <label className="datasets-control">
                    <span className="datasets-control-label">Rows</span>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      step={1}
                      value={datasetTopN}
                      onChange={(e) => setDatasetTopN(Math.max(5, Math.min(50, Number(e.target.value) || 20)))}
                      className="datasets-number-input"
                    />
                  </label>
                  <label className="datasets-control">
                    <span className="datasets-control-label">Chart type</span>
                    <select
                      className="datasets-type-select"
                      value={datasetChartTypeHint}
                      onChange={(e) => setDatasetChartTypeHint(e.target.value as 'auto' | 'line' | 'bar' | 'area' | 'table')}
                    >
                      <option value="auto">Auto</option>
                      <option value="line">Line</option>
                      <option value="bar">Bar</option>
                      <option value="area">Area</option>
                      <option value="table">Table</option>
                    </select>
                  </label>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={handlePublicDatasetSubmit}
                disabled={isProcessing || isGeneratingDatasetChart || isLoadingDatasets || !selectedDatasetId || !datasetPrompt.trim()}
              >
                <DatabaseIcon size={18} />
                <span>Generate from Dataset</span>
                <ArrowRight size={18} />
              </Button>
              </div>
            )}

            {mode === 'sql' && (
              <SqlDataInput onSubmit={onSubmit} isProcessing={isProcessing} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <aside className={`ai-instructions-dock ${isPromptPanelOpen ? 'open' : 'collapsed'}`}>
        {isPromptPanelOpen ? (
          <div className="ai-instructions-panel" aria-hidden={false}>
            <div className="ai-instructions-panel-head">
              <div className="ai-instructions-panel-title-wrap">
                <MessageSquare size={16} className="ai-instructions-icon" />
                <span className="ai-instructions-panel-title">AI Instructions</span>
              </div>
              <button
                type="button"
                className="ai-instructions-close"
                onClick={() => setIsPromptPanelOpen(false)}
                aria-label="Collapse AI instructions panel"
              >
                <X size={14} />
              </button>
            </div>
            <p className="ai-instructions-panel-copy">
              Optional notes used across all input types.
            </p>
            <label className="ai-instructions-label" htmlFor="ai-instructions-input">
              Extra guidance
            </label>
            <textarea
              id="ai-instructions-input"
              className="ai-instructions-textarea"
              placeholder="Focus on year-over-year growth and annotate major inflection points."
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <button
            type="button"
            className="ai-instructions-dock-toggle"
            onClick={() => setIsPromptPanelOpen(true)}
            aria-label="Expand AI instructions panel"
          >
            <MessageSquare size={16} />
            <span>AI Instructions</span>
          </button>
        )}
      </aside>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
