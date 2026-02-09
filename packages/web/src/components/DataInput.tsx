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
import { AIProcessingIndicator } from './AIProcessingIndicator';
import { Button } from './Button';
import './DataInput.css';

type InputMode = 'upload' | 'paste' | 'image' | 'sheets' | 'prompt' | 'stocks';

const STOCK_RANGES = ['1W', '1M', '3M', '6M', '1Y', 'YTD'] as const;

interface DataInputProps {
  onSubmit: (data: ChartData) => void;
  isProcessing: boolean;
}

const INPUT_MODES = [
  { id: 'upload' as const, icon: FileSpreadsheet, label: 'Upload CSV' },
  { id: 'paste' as const, icon: Clipboard, label: 'Paste Data' },
  { id: 'image' as const, icon: Image, label: 'Upload Image' },
  { id: 'sheets' as const, icon: Link2, label: 'Google Sheets' },
  { id: 'prompt' as const, icon: Sparkles, label: 'Describe' },
  { id: 'stocks' as const, icon: TrendingUp, label: 'Stocks' },
];

export function DataInput({ onSubmit, isProcessing }: DataInputProps) {
  const [mode, setMode] = useState<InputMode>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [promptText, setPromptText] = useState('');
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
  const tickerDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ticker2DebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tickerWrapperRef = useRef<HTMLDivElement>(null);
  const ticker2WrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

    try {
      const data = await fetchStockData(selectedTicker, stockRange, selectedTicker2 || undefined);
      // Show chart immediately
      onSubmit(data);

      // Fetch insights in background
      fetchStockInsights(data.labels, data.series, data.suggestedTitle || '')
        .then((insight) => {
          // Update with insights when ready
          onSubmit({ ...data, aiReasoning: insight });
        })
        .catch(() => {
          // Silently ignore insight failures - chart still works
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setIsLoadingStock(false);
    }
  }, [selectedTicker, selectedTicker2, stockRange, onSubmit]);

  const parseCSVData = useCallback((content: string, sourceType: 'csv' | 'paste'): ChartData | null => {
    const result = Papa.parse(content, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    if (result.errors.length > 0) {
      setError('Unable to parse data. Please check the format.');
      return null;
    }

    const rows = result.data as (string | number)[][];
    if (rows.length < 2) {
      setError('Data must have at least a header row and one data row.');
      return null;
    }

    const headers = rows[0].map((header) => String(header).trim());
    const labels = rows.slice(1).map(row => String(row[0]));
    const xAxisLabel = headers[0] || undefined;

    const series = headers.slice(1).map((name, colIndex) => ({
      name: name || `Series ${colIndex + 1}`,
      data: rows.slice(1).map(row => {
        const val = row[colIndex + 1];
        return typeof val === 'number' ? val : parseFloat(String(val)) || 0;
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
            handleImageUpload(file);
          }
          return;
        }
      }
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [mode, handleImageUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      if (mode === 'image') {
        if (file.type.startsWith('image/')) {
          handleImageUpload(file);
        } else {
          setError('Please upload an image file.');
        }
      } else {
        if (file.name.endsWith('.csv') || file.type === 'text/csv') {
          handleFileUpload(file);
        } else {
          setError('Please upload a CSV file.');
        }
      }
    }
  }, [mode, handleFileUpload, handleImageUpload]);

  const handlePasteSubmit = useCallback(() => {
    setError(null);
    if (!pasteContent.trim()) {
      setError('Please paste some data first.');
      return;
    }

    const data = parseCSVData(pasteContent, 'paste');
    if (data) {
      onSubmit(data);
    }
  }, [pasteContent, parseCSVData, onSubmit]);

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

  const handlePromptSubmit = useCallback(async () => {
    setError(null);
    if (!promptText.trim()) {
      setError('Please describe the chart you want to create.');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const data = await generateChartFromPrompt(promptText.trim());
      onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate chart');
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [promptText, onSubmit]);

  return (
    <div className="data-input">
      <div className="input-mode-tabs">
        {INPUT_MODES.map((inputMode) => (
          <button
            key={inputMode.id}
            className={`mode-tab ${mode === inputMode.id ? 'active' : ''}`}
            onClick={() => {
              setMode(inputMode.id);
              setError(null);
              setFileName(null);
            }}
          >
            <inputMode.icon size={18} />
            <span>{inputMode.label}</span>
          </button>
        ))}
      </div>

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
            <div
              className={`drop-zone ${dragActive ? 'active' : ''} ${fileName ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => mode === 'image' ? imageInputRef.current?.click() : fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                hidden
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                hidden
              />

              {(isProcessing || isAnalyzing) ? (
                <AIProcessingIndicator
                  size="md"
                  label={mode === 'image' ? 'Analyzing your image...' : 'Processing your data...'}
                  hint={mode === 'image' ? 'Extracting data with GPT-4o Vision' : undefined}
                  statusMessages={mode === 'image'
                    ? ['Reading chart elements...', 'Extracting data points...', 'Identifying patterns...', 'Building your chart...']
                    : ['Parsing columns...', 'Detecting data types...', 'Choosing the best chart...', 'Almost ready...']
                  }
                />
              ) : fileName ? (
                <div className="drop-zone-success">
                  <Check size={32} />
                  <span>{fileName}</span>
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
          )}

          {mode === 'paste' && (
            <div className="paste-input">
              <textarea
                className="paste-textarea"
                placeholder={`Paste your data here...\n\nExample format:\nCategory,Sales,Profit\nJan,1200,400\nFeb,1900,520\nMar,3000,890`}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                spellCheck={false}
              />
              {isProcessing ? (
                <AIProcessingIndicator
                  size="sm"
                  label="Generating your chart..."
                  statusMessages={['Analyzing data structure...', 'Selecting chart type...', 'Optimizing layout...', 'Almost ready...']}
                />
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handlePasteSubmit}
                  disabled={!pasteContent.trim()}
                >
                  <span>Generate Chart</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

          {mode === 'sheets' && (
            <div className="sheets-input">
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
              {isProcessing ? (
                <AIProcessingIndicator
                  size="sm"
                  label="Importing & generating..."
                  statusMessages={['Fetching spreadsheet...', 'Parsing data...', 'Selecting chart type...', 'Almost ready...']}
                />
              ) : (
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

          {mode === 'prompt' && (
            <div className="prompt-generate">
              <textarea
                className="prompt-generate-textarea"
                placeholder={`Describe the chart you want to create...\n\nExamples:\n- "Monthly revenue for a SaaS startup growing 15% MoM"\n- "Top 10 programming languages by popularity in 2024"\n- "US vs China GDP comparison from 2000 to 2023"`}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                spellCheck={false}
              />
              {(isProcessing || isGeneratingPrompt) ? (
                <AIProcessingIndicator
                  size="sm"
                  label="Generating your chart..."
                  statusMessages={['Interpreting your description...', 'Generating realistic data...', 'Choosing chart type...', 'Almost ready...']}
                />
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handlePromptSubmit}
                  disabled={!promptText.trim()}
                >
                  <Sparkles size={18} />
                  <span>Generate Chart</span>
                  <ArrowRight size={18} />
                </Button>
              )}
            </div>
          )}

          {mode === 'stocks' && (
            <div className="stocks-input">
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

              {(isProcessing || isLoadingStock) ? (
                <AIProcessingIndicator
                  size="sm"
                  label="Fetching stock data..."
                  statusMessages={['Connecting to market data...', 'Downloading price history...', 'Building your chart...', 'Almost ready...']}
                />
              ) : (
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
        </motion.div>
      </AnimatePresence>

      {mode !== 'prompt' && mode !== 'stocks' && (
      <div className="prompt-input-wrapper">
        <MessageSquare size={18} className="prompt-icon" />
        <input
          type="text"
          className="prompt-input"
          placeholder="Optional: Add instructions for the AI (e.g., 'Focus on year-over-year growth')"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
        />
      </div>
      )}

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
