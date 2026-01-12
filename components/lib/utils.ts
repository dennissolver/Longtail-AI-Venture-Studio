import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(num))
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0
  return Math.min((current / target) * 100, 100)
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function timeAgo(date: string | Date): string {
  const now = new Date()
  const past = new Date(date)
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
  ]

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds)
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`
    }
  }

  return 'just now'
}

/**
 * Get color for status badge
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'emerald',
    live: 'emerald',
    launched: 'emerald',
    trial: 'blue',
    trialing: 'blue',
    beta: 'blue',
    building: 'amber',
    development: 'amber',
    planned: 'gray',
    paused: 'gray',
    churned: 'rose',
    canceled: 'rose',
    past_due: 'amber',
    inactive: 'gray',
  }
  return colors[status.toLowerCase()] || 'gray'
}

/**
 * Get color for plan badge
 */
export function getPlanColor(plan: string): string {
  const colors: Record<string, string> = {
    free: 'slate',
    trial: 'blue',
    starter: 'blue',
    basic: 'blue',
    pro: 'emerald',
    professional: 'emerald',
    premium: 'violet',
    enterprise: 'amber',
    business: 'amber',
  }
  return colors[plan.toLowerCase()] || 'gray'
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

/**
 * Calculate ARR from MRR
 */
export function mrrToArr(mrr: number): number {
  return mrr * 12
}

/**
 * Calculate subscribers needed for target ARR
 */
export function subscribersNeeded(targetArr: number, avgRevenuePerUser: number): number {
  if (avgRevenuePerUser <= 0) return 0
  return Math.ceil(targetArr / avgRevenuePerUser)
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
