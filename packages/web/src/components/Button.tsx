import { forwardRef, type ButtonHTMLAttributes } from 'react';
import './Button.css';

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', fullWidth = false, className, type = 'button', ...rest },
  ref,
) {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth ? 'button--full' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button ref={ref} className={classes} type={type} {...rest} />;
});
