import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <section className={`card ${className}`}>{children}</section>
}

interface StatusBadgeProps {
  children: ReactNode
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'
}

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status status--${tone}`}>{children}</span>
}


interface ModalProps {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  width?: 'small' | 'medium' | 'large'
}

export function Modal({
  open,
  title,
  description,
  children,
  onClose,
  width = 'medium',
}: ModalProps) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className={`modal modal--${width}`}
        role="dialog"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>
        <div className="modal__content">{children}</div>
      </section>
    </div>
  )
}
