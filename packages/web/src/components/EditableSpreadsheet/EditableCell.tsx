import { useState, useRef, useEffect, useMemo } from 'react';
import { createFixedNumberFormatter } from '../../utils/numberFormat';

interface EditableCellProps {
  value: string | number;
  onChange: (value: string | number) => void;
  isNumeric?: boolean;
  decimalPlaces?: number;
  isHeader?: boolean;
}

export function EditableCell({
  value,
  onChange,
  isNumeric = false,
  decimalPlaces,
  isHeader = false,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(String(value));
  };

  const handleBlur = () => {
    commitEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      // Move to next row
      const target = e.target as HTMLElement;
      const cell = target.closest('td');
      if (cell) {
        const row = cell.parentElement;
        const nextRow = row?.nextElementSibling;
        if (nextRow) {
          const cellIndex = Array.from(row?.children || []).indexOf(cell);
          const nextCell = nextRow.children[cellIndex] as HTMLElement;
          nextCell?.querySelector('.editable-cell')?.dispatchEvent(
            new MouseEvent('dblclick', { bubbles: true })
          );
        }
      }
    } else if (e.key === 'Tab') {
      commitEdit();
      // Let default tab behavior handle navigation
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(String(value));
    }
  };

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();

    if (trimmed === String(value)) return;

    if (isNumeric) {
      const numValue = parseFloat(trimmed);
      if (!isNaN(numValue)) {
        onChange(numValue);
      } else {
        setEditValue(String(value));
      }
    } else {
      onChange(trimmed);
    }
  };

  const numberFormatter = useMemo(() => {
    if (!isNumeric || typeof decimalPlaces !== 'number') return null;
    return createFixedNumberFormatter(decimalPlaces);
  }, [isNumeric, decimalPlaces]);

  const displayValue = isNumeric && typeof value === 'number'
    ? (numberFormatter ? numberFormatter.format(value) : value.toLocaleString())
    : value;

  return (
    <div
      className={`editable-cell ${isEditing ? 'editing' : ''} ${isHeader ? 'header-cell' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type={isNumeric ? 'text' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="cell-input"
          inputMode={isNumeric ? 'decimal' : 'text'}
        />
      ) : (
        <span className="cell-value">{displayValue}</span>
      )}
    </div>
  );
}
