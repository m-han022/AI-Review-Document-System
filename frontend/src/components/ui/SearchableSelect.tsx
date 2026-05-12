import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';
import { ChevronDownIcon, XIcon } from './Icon';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  hideValue?: boolean;
  style?: React.CSSProperties;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error,
  className = '',
  hideValue = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);


  // Find the label for the current value
  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  // Update search term when value changes externally
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Filter options based on search term
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className={`ds-searchable-select ${className} ${disabled ? 'is-disabled' : ''} ${error ? 'has-error' : ''}`} ref={containerRef} style={style}>
      {label && <label className="ds-input-label">{label}</label>}
      
      <div 
        className={`ds-select-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={handleToggle}
      >
        <div className="ds-select-value-container">
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              className="ds-select-search-input"
              placeholder={displayValue || placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`ds-select-value ${!displayValue ? 'is-placeholder' : ''}`}>
              {displayValue || placeholder}
            </span>
          )}
        </div>
        
        <div className="ds-select-actions">
          {value && !disabled && (
            <button className="ds-select-clear-btn" onClick={handleClear}>
              <XIcon size="sm" />
            </button>
          )}
          <ChevronDownIcon className={`ds-select-chevron ${isOpen ? 'is-rotated' : ''}`} size="sm" />
        </div>
      </div>

      {isOpen && (
        <div className="ds-select-dropdown">
          <div className="ds-select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`ds-select-option ${opt.value === value ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.label}
                  {!hideValue && opt.value && <span className="ds-select-option-sub">{opt.value}</span>}
                </div>
              ))
            ) : (
              <div className="ds-select-no-results">No options found</div>
            )}
          </div>
        </div>
      )}
      
      {error && <p className="ds-input-error">{error}</p>}
    </div>
  );
};
