import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    rpc: vi.fn(),
    channel: vi.fn(),
  }
}))

import { mapProfileToUser } from './useUserStore'
import type { User } from '@/types'

describe('mapProfileToUser Utility Function', () => {
  it('should map profile to user with basic defaults', () => {
    const rawProfile = {
      id: 'user-123',
      name: 'John Doe',
      role: 'admin',
      email: 'john@example.com',
      is_active: true,
      is_online: false,
    }

    const mapped = mapProfileToUser(rawProfile)

    expect(mapped.id).toBe('user-123')
    expect(mapped.name).toBe('John Doe')
    expect(mapped.role).toBe('admin')
    expect(mapped.email).toBe('john@example.com')
    expect(mapped.is_active).toBe(true)
    expect(mapped.is_online).toBe(false)
    expect(mapped.created_at).toBeDefined()
    expect(mapped.updated_at).toBeDefined()
  })

  it('should map profile using an existing user as baseline (incremental merge)', () => {
    const baselineUser: User = {
      id: 'user-123',
      name: 'John Doe',
      role: 'courier',
      email: 'john@example.com',
      is_active: true,
      is_online: true,
      courier_status: 'on',
      vehicle_type: 'motorcycle',
      plate_number: 'B 1234 ABC',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    // Only partial changes from a Realtime update
    const rawProfileUpdate = {
      id: 'user-123',
      courier_status: 'stay',
      stay_basecamp_id: 'camp-456',
    }

    const mapped = mapProfileToUser(rawProfileUpdate, baselineUser)

    expect(mapped.id).toBe('user-123')
    expect(mapped.name).toBe('John Doe') // Preserved
    expect(mapped.role).toBe('courier') // Preserved
    expect(mapped.email).toBe('john@example.com') // Preserved
    expect(mapped.courier_status).toBe('stay') // Updated
    expect(mapped.stay_basecamp_id).toBe('camp-456') // Updated
    expect(mapped.is_online).toBe(true) // Recomputed to true: active = true, status = stay
  })

  describe('is_online Computation Logic for Couriers', () => {
    it('should compute is_online as true when courier is active and status is "on"', () => {
      const profile = {
        id: 'courier-1',
        role: 'courier',
        is_active: true,
        courier_status: 'on',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_online).toBe(true)
    })

    it('should compute is_online as true when courier is active and status is "stay"', () => {
      const profile = {
        id: 'courier-1',
        role: 'courier',
        is_active: true,
        courier_status: 'stay',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_online).toBe(true)
    })

    it('should compute is_online as false when courier status is "off"', () => {
      const profile = {
        id: 'courier-1',
        role: 'courier',
        is_active: true,
        courier_status: 'off',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_online).toBe(false)
    })

    it('should compute is_online as false if courier is inactive, regardless of status', () => {
      const profile = {
        id: 'courier-1',
        role: 'courier',
        is_active: false,
        courier_status: 'on',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_online).toBe(false)
    })
  })

  describe('is_online Computation Logic for Non-Couriers', () => {
    it('should use the database provided is_online value directly', () => {
      const profile = {
        id: 'admin-1',
        role: 'admin',
        is_active: true,
        is_online: true,
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_online).toBe(true)
    })

    it('should fallback to baseline is_online if not specified in update payload', () => {
      const baselineUser: User = {
        id: 'admin-1',
        name: 'Admin User',
        role: 'admin',
        email: 'admin@example.com',
        is_active: true,
        is_online: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }

      const updatePayload = {
        id: 'admin-1',
        name: 'New Admin Name',
      }

      const mapped = mapProfileToUser(updatePayload, baselineUser)
      expect(mapped.is_online).toBe(true) // Retains true from baseline
      expect(mapped.name).toBe('New Admin Name')
    })
  })

  describe('Fallback and Defaults', () => {
    it('should use default is_active as true if not specified', () => {
      const profile = {
        id: 'user-1',
        role: 'admin',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.is_active).toBe(true)
    })

    it('should fallback to default dates if not provided', () => {
      const profile = {
        id: 'user-1',
        role: 'admin',
      }
      const mapped = mapProfileToUser(profile)
      expect(mapped.created_at).toBeDefined()
      expect(mapped.updated_at).toBeDefined()
    })
  })
})
