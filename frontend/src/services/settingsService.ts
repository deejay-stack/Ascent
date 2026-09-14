import type { AuthUser } from '../types/auth'
import type { StoreSettings } from '../types/commerce'
import { getState, mutate } from './mockStore'
export const settingsService = {
  get: () => ({ ...getState().settings }),
  async save(settings: StoreSettings, actor: AuthUser) {
    if (actor.role !== 'owner') throw new Error('Only the owner can update settings.')
    if (
      !settings.name.trim() ||
      !settings.address.trim() ||
      !Number.isFinite(settings.taxRate) ||
      settings.taxRate < 0 ||
      settings.taxRate > 100
    )
      throw new Error('Enter a store name, address and tax between 0 and 100%.')
    mutate((draft) => {
      draft.settings = { ...settings }
    })
  },
}
