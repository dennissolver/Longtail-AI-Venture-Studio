import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-AU').format(num)
}

export function formatPercent(num: number, decimals: number = 1): string {
  return `${num.toFixed(decimals)}%`
}

export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0
  return Math.min((current / target) * 100, 100)
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'emerald'
    case 'trial':
      return 'blue'
    case 'paused':
      return 'yellow'
    case 'churned':
    case 'archived':
      return 'red'
    case 'exited':
      return 'purple'
    default:
      return 'gray'
  }
}

export function getPlanColor(plan: string): string {
  switch (plan) {
    case 'free':
      return 'gray'
    case 'starter':
      return 'blue'
    case 'pro':
      return 'emerald'
    case 'enterprise':
      return 'purple'
    case 'custom':
      return 'amber'
    default:
      return 'gray'
  }
}

export function timeAgo(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return then.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
