import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ArrowUp, ArrowDown, Check } from 'lucide-react';
import './SortDropdown.css';

type SortField = 'created_at' | 'updated_at' | 'title' | 'view_count';
type SortOrder = 'asc' | 'desc';

interface SortDropdownProps {
  sort: SortField;
  order: SortOrder;
  onSort: (sort: SortField, order: SortOrder) => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'updated_at', label: 'Last modified' },
  { value: 'created_at', label: 'Date created' },
  { value: 'title', label: 'Name' },
  { value: 'view_count', label: 'Most viewed' },
];

export function SortDropdown({ sort, order, onSort }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentOption = SORT_OPTIONS.find((o) => o.value === sort);

  const handleSelect = (field: SortField) => {
    if (field === sort) {
      onSort(field, order === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'desc');
    }
    setIsOpen(false);
  };

  const toggleOrder = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSort(sort, order === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="sort-dropdown" ref={dropdownRef}>
      <button
        className="sort-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="sort-dropdown-label">{currentOption?.label}</span>
        <button className="sort-dropdown-order" onClick={toggleOrder} title={`Sort ${order === 'asc' ? 'ascending' : 'descending'}`}>
          {order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
        <ChevronDown size={14} className={`sort-dropdown-chevron ${isOpen ? 'sort-dropdown-chevron--open' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sort-dropdown-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`sort-dropdown-item ${option.value === sort ? 'sort-dropdown-item--selected' : ''}`}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {option.value === sort && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
