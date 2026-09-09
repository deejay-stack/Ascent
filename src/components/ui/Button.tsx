import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: ButtonVariant
  fullWidth?: boolean
}

export function Button({
  children,
  className = '',
  fullWidth = false,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'border-transparent bg-brand-700 text-white shadow-[0_12px_28px_rgba(23,76,44,0.16)] hover:bg-brand-600 dark:bg-brand-500 dark:text-white dark:hover:bg-brand-600',
    secondary:
      'border-ink-200 bg-white text-ink-900 shadow-[0_14px_34px_rgba(17,24,39,0.08)] hover:border-ink-400 hover:bg-ink-50 dark:border-white/12 dark:bg-white/8 dark:text-white dark:hover:bg-white/12',
    ghost:
      'border-transparent bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-950 dark:text-ink-200 dark:hover:bg-white/10 dark:hover:text-white',
  }

  return (
    <button
      className={[
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-bold leading-none transition duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-45',
        'hover:-translate-y-px active:translate-y-0',
        variants[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
