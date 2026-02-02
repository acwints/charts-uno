import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import {
  Upload,
  FileSpreadsheet,
  Image,
  Link2,
  Clipboard,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import type { ChartData } from '../types';
import { analyzeImage } from '../services/imageAnalysis';
import { Button } from './Button';
import './DataInput.css';

type InputMode = 'upload' | 'paste' | 'image' | 'sheets';

interface DataInputProps {
  onSubmit: (data: ChartData) => void;
  isProcessing: boolean;
}

const INPUT_MODES = [
  { id: 'upload' as const, icon: FileSpreadsheet, label: 'Upload CSV' },
  { id: 'paste' as const, icon: Clipboard, label: 'Paste Data' },
  { id: 'image' as const, icon: Image, label: 'Upload Image' },
  { id: 'sheets' as const, icon: Link2, label: 'Google Sheets' },
];

export function DataInput({ onSubmit, isProcessing }: DataInputProps) {
  const [mode, setMode] = useState<InputMode>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
  }, [mode, handleFileUpload]);

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
                <div className="drop-zone-processing">
                  {mode === 'image' ? (
                    <>
                      <Sparkles size={32} className="pulse" />
                      <span>AI analyzing image...</span>
                      <span className="processing-hint">Extracting data with GPT-4o Vision</span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={32} className="spin" />
                      <span>Processing file...</span>
                    </>
                  )}
                </div>
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
                      ? 'Drop an image of your chart here or click to upload'
                      : 'Drop your CSV file here or click to upload'
                    }
                  </p>
                  <span className="drop-zone-hint">
                    {mode === 'image'
                      ? 'Supports PNG, JPG, WebP'
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
              <Button
                variant="primary"
                size="lg"
                onClick={handlePasteSubmit}
                disabled={isProcessing || !pasteContent.trim()}
              >
                {isProcessing ? (
                  <>
                    <Sparkles size={18} className="pulse" />
                    <span>AI selecting best chart...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Chart</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </div>
          )}

          {mode === 'sheets' && (
            <div className="sheets-input">
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
              <Button
                variant="primary"
                size="lg"
                onClick={handleSheetsSubmit}
                disabled={isProcessing || !sheetsUrl.trim()}
              >
                {isProcessing ? (
                  <>
                    <Sparkles size={18} className="pulse" />
                    <span>AI selecting best chart...</span>
                  </>
                ) : (
                  <>
                    <span>Import & Generate</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

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
