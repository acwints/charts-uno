import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, FileSpreadsheet, Image, Copy, Check } from 'lucide-react';
import { exportToCSV, exportToPNG, copyToClipboard, type WatermarkSettings } from '../../services/exportService';
import { Button } from '../Button';
import type { ChartData } from '../../types';
import './ExportMenu.css';

interface ExportMenuProps {
  data: ChartData;
  chartRef: React.RefObject<HTMLElement | null>;
  title?: string;
  watermark?: WatermarkSettings;
}

export function ExportMenu({ data, chartRef, title, watermark }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  const handleCopy = async () => {
    setExporting('copy');
    try {
      await copyToClipboard(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <Button
        variant="primary"
        className="export-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Download size={16} />
        <span>Export</span>
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
              disabled={exporting !== null}
            >
              <FileSpreadsheet size={16} />
              <span>Download CSV</span>
              {exporting === 'csv' && <span className="export-loading">...</span>}
            </button>

            <button
              className="export-option"
              onClick={handlePNG}
              disabled={exporting !== null}
            >
              <Image size={16} />
              <span>Download PNG</span>
              {exporting === 'png' && <span className="export-loading">...</span>}
            </button>

            <div className="export-divider" />

            <button
              className="export-option"
              onClick={handleCopy}
              disabled={exporting !== null}
            >
              {copied ? <Check size={16} className="copied-icon" /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
