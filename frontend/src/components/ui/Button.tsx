import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'sakura' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  fullWidth,
  className = '',
  disabled,
  ...props
}) => {
  const baseClass = 'ds-button';
  const variantClass = `ds-button--${variant}`;
  const sizeClass = `ds-button--${size}`;
  const loadingClass = isLoading ? 'is-loading' : '';
  const fullWidthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${loadingClass} ${fullWidthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="ds-button__spinner" />}
      {!isLoading && leftIcon && <span className="ds-button__icon-left">{leftIcon}</span>}
      <span className="ds-button__content">{children}</span>
      {!isLoading && rightIcon && <span className="ds-button__icon-right">{rightIcon}</span>}
    </button>
  );
};
