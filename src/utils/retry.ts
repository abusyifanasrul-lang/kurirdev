import { PostgrestError } from '@supabase/supabase-js'

interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  onRetry?: (attempt: number, error: any) => void
}

/**
 * Executes a function with exponential backoff retry logic.
 * Optimized for Supabase/Network errors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    onRetry
  } = options

  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // If it's the last attempt, don't wait, just throw
      if (attempt === maxAttempts) {
        break
      }

      // Determine if error is retryable (Network issues, 5xx, etc.)
      const isPostgrestError = (error as PostgrestError).code !== undefined
      const isNetworkError = error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('fetch')
      
      // We retry on network errors or transient server errors (5xx)
      // Supabase PostgrestError codes for transient issues are usually empty or handled by fetch
      const shouldRetry = isNetworkError || !isPostgrestError

      if (!shouldRetry) {
        throw error
      }

      if (onRetry) {
        onRetry(attempt, error)
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
