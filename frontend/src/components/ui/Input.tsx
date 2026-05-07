import React, { useId } from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  multiline?: boolean;
  rows?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  multiline = false,
  className = '',
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const containerClass = `ds-input-group ${error ? 'has-error' : ''} ${className}`;
  
  return (
    <div className={containerClass}>
      {label && (
        <label htmlFor={inputId} className="ds-input-label">
          {label}
        </label>
      )}
      
      {multiline ? (
        <textarea
          id={inputId}
          className="ds-input ds-textarea"
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={inputId}
          className="ds-input"
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      
      {error ? (
        <p className="ds-input-error">{error}</p>
      ) : helperText ? (
        <p className="ds-input-helper">{helperText}</p>
      ) : null}
    </div>
  );
};
