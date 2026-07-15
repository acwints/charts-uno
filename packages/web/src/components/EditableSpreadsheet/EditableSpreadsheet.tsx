import { useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import { EditableCell } from './EditableCell';
import type { ChartData, ColorScheme } from '../../types';
import { COLOR_PALETTES } from '../../types';
import { getAdaptiveDecimalPlaces } from '../../utils/numberFormat';
import './EditableSpreadsheet.css';

function isTemporalNumericField(name: string): boolean {
  return /^(?:calendar\s+|season\s+)?(?:year|date)s?$/i.test(name.trim());
}

interface EditableSpreadsheetProps {
  data: ChartData;
  colorScheme: ColorScheme;
  isDirty: boolean;
  onChange: (data: ChartData) => void;
  onReset: () => void;
}

export function EditableSpreadsheet({
  data,
  colorScheme,
  isDirty,
  onChange,
  onReset,
}: EditableSpreadsheetProps) {
  const colors = COLOR_PALETTES[colorScheme];
  const numericValues = useMemo(() => {
    return data.series.flatMap((series) =>
      series.data.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    );
  }, [data.series]);
  const numericDecimalPlaces = useMemo(() => getAdaptiveDecimalPlaces(numericValues), [numericValues]);

  const handleLabelChange = useCallback(
    (index: number, value: string | number) => {
      const newLabels = [...data.labels];
      newLabels[index] = String(value);
      onChange({ ...data, labels: newLabels });
    },
    [data, onChange]
  );

  const handleSeriesNameChange = useCallback(
    (seriesIndex: number, value: string | number) => {
      const newSeries = [...data.series];
      newSeries[seriesIndex] = { ...newSeries[seriesIndex], name: String(value) };
      onChange({ ...data, series: newSeries });
    },
    [data, onChange]
  );

  const handleCategoricalValueChange = useCallback(
    (columnIndex: number, dataIndex: number, value: string | number) => {
      const categoricalColumns = (data.categoricalColumns ?? []).map((column, index) => {
        if (index !== columnIndex) return column;
        const newData = [...column.data];
        newData[dataIndex] = String(value);
        return { ...column, data: newData };
      });
      onChange({ ...data, categoricalColumns });
    },
    [data, onChange]
  );

  const handleValueChange = useCallback(
    (seriesIndex: number, dataIndex: number, value: string | number) => {
      const newSeries = [...data.series];
      const newData = [...newSeries[seriesIndex].data];
      if (typeof value === 'number') {
        newData[dataIndex] = value;
      } else {
        const trimmed = value.trim();
        newData[dataIndex] = trimmed === '' ? null : (parseFloat(trimmed) || 0);
      }
      newSeries[seriesIndex] = { ...newSeries[seriesIndex], data: newData };
      onChange({ ...data, series: newSeries });
    },
    [data, onChange]
  );

  const addRow = useCallback(() => {
    const newLabels = [...data.labels, `Row ${data.labels.length + 1}`];
    const categoricalColumns = data.categoricalColumns?.map((column) => ({
      ...column,
      data: [...column.data, ''],
    }));
    const newSeries = data.series.map((series) => ({
      ...series,
      data: [...series.data, 0],
    }));
    onChange({ ...data, labels: newLabels, series: newSeries, categoricalColumns });
  }, [data, onChange]);

  const deleteRow = useCallback(
    (index: number) => {
      if (data.labels.length <= 1) return;
      const newLabels = data.labels.filter((_, i) => i !== index);
      const categoricalColumns = data.categoricalColumns?.map((column) => ({
        ...column,
        data: column.data.filter((_, i) => i !== index),
      }));
      const newSeries = data.series.map((series) => ({
        ...series,
        data: series.data.filter((_, i) => i !== index),
      }));
      onChange({ ...data, labels: newLabels, series: newSeries, categoricalColumns });
    },
    [data, onChange]
  );

  const addColumn = useCallback(() => {
    const newSeries = [
      ...data.series,
      {
        name: `Series ${data.series.length + 1}`,
        data: new Array(data.labels.length).fill(0),
      },
    ];
    onChange({ ...data, series: newSeries });
  }, [data, onChange]);

  const deleteColumn = useCallback(
    (index: number) => {
      if (data.series.length <= 1) return;
      const newSeries = data.series.filter((_, i) => i !== index);
      onChange({ ...data, series: newSeries });
    },
    [data, onChange]
  );

  return (
    <motion.div
      className="editable-spreadsheet"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="spreadsheet-header">
        <div className="spreadsheet-header-left">
          <span className="spreadsheet-label">DATA</span>
          {isDirty && <span className="dirty-indicator">Modified</span>}
        </div>
        <div className="spreadsheet-actions">
          {isDirty && (
            <button className="spreadsheet-action" onClick={onReset} title="Reset to original">
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          )}
          <button className="spreadsheet-action" onClick={addColumn} title="Add series">
            <Plus size={14} />
            <span>Column</span>
          </button>
          <button className="spreadsheet-action" onClick={addRow} title="Add row">
            <Plus size={14} />
            <span>Row</span>
          </button>
        </div>
      </div>

      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th className="spreadsheet-th corner-cell">
                <div className="corner-header">{data.xAxisLabel || 'Label'}</div>
              </th>
              {data.categoricalColumns?.map((column, idx) => (
                <th key={`categorical-${idx}`} className="spreadsheet-th series-header">
                  <div className="series-header-content">
                    <span className="categorical-column-header">{column.name}</span>
                  </div>
                </th>
              ))}
              {data.series.map((series, idx) => (
                <th key={idx} className="spreadsheet-th series-header">
                  <div className="series-header-content">
                    <span
                      className="series-color"
                      style={{ background: colors[idx % colors.length] }}
                    />
                    <EditableCell
                      value={series.name}
                      onChange={(v) => handleSeriesNameChange(idx, v)}
                      isHeader
                    />
                    {data.series.length > 1 && (
                      <button
                        className="delete-btn column-delete"
                        onClick={() => deleteColumn(idx)}
                        title="Delete column"
                        aria-label="Delete column"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.labels.map((label, rowIdx) => (
              <tr key={rowIdx}>
                <td className="spreadsheet-td label-cell">
                  <div className="label-cell-content">
                    <EditableCell
                      value={label}
                      onChange={(v) => handleLabelChange(rowIdx, v)}
                    />
                    {data.labels.length > 1 && (
                      <button
                        className="delete-btn row-delete"
                        onClick={() => deleteRow(rowIdx)}
                        title="Delete row"
                        aria-label="Delete row"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
                {data.categoricalColumns?.map((column, colIdx) => (
                  <td key={`categorical-${colIdx}`} className="spreadsheet-td categorical-cell">
                    <EditableCell
                      value={column.data[rowIdx] ?? ''}
                      onChange={(v) => handleCategoricalValueChange(colIdx, rowIdx, v)}
                    />
                  </td>
                ))}
                {data.series.map((series, colIdx) => (
                  <td key={colIdx} className="spreadsheet-td value-cell">
                    <EditableCell
                      value={series.data?.[rowIdx] ?? ''}
                      onChange={(v) => handleValueChange(colIdx, rowIdx, v)}
                      isNumeric
                      decimalPlaces={isTemporalNumericField(series.name) ? 0 : numericDecimalPlaces}
                      useGrouping={!isTemporalNumericField(series.name)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
