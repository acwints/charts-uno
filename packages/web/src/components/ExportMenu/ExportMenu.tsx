import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Download from 'lucide-react/dist/esm/icons/download';
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet';
import Image from 'lucide-react/dist/esm/icons/image';
import Code from 'lucide-react/dist/esm/icons/code';
import Check from 'lucide-react/dist/esm/icons/check';
import {
  exportToCSV,
  exportToPNG,
  generateEmbedCode,
  type WatermarkSettings,
} from '../../services/exportService';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../Button';
import type { ChartData } from '../../types';
import './ExportMenu.css';

interface ExportMenuProps {
  data: ChartData;
  chartRef: React.RefObject<HTMLElement | null>;
  chartId?: string;
  title?: string;
  watermark?: WatermarkSettings;
  isAuthenticated?: boolean;
}

export function ExportMenu({ data, chartRef, chartId, title, watermark, isAuthenticated = false }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filename = title?.toLowerCase().replace(/\s+/g, '-') || 'chart';

  const handleCSV = async () => {
    setExporting('csv');
    try {
      await exportToCSV(data, filename);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Unable to download CSV. Please try again.');
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handlePNG = async () => {
    if (!chartRef.current) return;
    setExporting('png');
    try {
      await exportToPNG(chartRef.current, filename, watermark);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      toast.error('Unable to download PNG. Please try Copy Image instead.');
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleEmbed = async () => {
    if (!chartId) return;
    const code = generateEmbedCode(chartId, title);
    await navigator.clipboard.writeText(code);
    setCopiedEmbed(true);
    toast.success('Embed code copied to clipboard.');
    setTimeout(() => setCopiedEmbed(false), 2000);
    setIsOpen(false);
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <Button
        variant="default"
        size="sm"
        className="export-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isAuthenticated}
      >
        <Download size={16} />
        <span>Download</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="export-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className="export-option"
              onClick={handleCSV}
              disabled={exporting !== null || !isAuthenticated}
            >
              <FileSpreadsheet size={16} />
              <span>Download CSV</span>
              {exporting === 'csv' && <span className="export-loading">...</span>}
            </button>

            <button
              className="export-option"
              onClick={handlePNG}
              disabled={exporting !== null || !isAuthenticated}
            >
              <Image size={16} />
              <span>Download PNG</span>
              {exporting === 'png' && <span className="export-loading">...</span>}
            </button>

            {chartId && (
              <>
                <div className="export-divider" />
                <button
                  className="export-option"
                  onClick={handleEmbed}
                  disabled={exporting !== null || !isAuthenticated}
                >
                  {copiedEmbed ? <Check size={16} className="copied-icon" /> : <Code size={16} />}
                  <span>{copiedEmbed ? 'Copied!' : 'Copy Embed Code'}</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
