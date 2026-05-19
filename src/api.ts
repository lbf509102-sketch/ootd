import type { AvatarProfile, SavedLook, TryOnSession, UserPreferences, UserSession, WardrobeItem, WeatherProfile } from './types'

let authToken = ''
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

function authHeaders() {
  const headers: Record<string, string> = {}
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

function withBase(path: string) {
  return `${apiBaseUrl}${path}`
}

export function setAuthToken(token: string) {
  authToken = token
}

export interface BootstrapResponse {
  selectedCity: string
  preferences: UserPreferences
  avatarProfile: AvatarProfile
  wardrobe: WardrobeItem[]
  cities: Array<{ city: string }>
  user: Omit<UserSession, 'token'>
  history: SavedLook[]
  favorites: SavedLook[]
  tryOnSessions: TryOnSession[]
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(payload.message ?? `Request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

export async function requestLoginCode(phone: string) {
  return parseJson<{ ok: true; devCode: string; message: string }>(
    await fetch(withBase('/api/auth/request-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }),
  )
}

export async function verifyLoginCode(phone: string, code: string) {
  const result = await parseJson<{ token: string; user: Omit<UserSession, 'token'> }>(
    await fetch(withBase('/api/auth/verify-code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }),
  )
  setAuthToken(result.token)
  return {
    token: result.token,
    user: {
      ...result.user,
      token: result.token,
    },
  }
}

export async function fetchSession() {
  const result = await parseJson<{ token: string; user: Omit<UserSession, 'token'> }>(
    await fetch(withBase('/api/auth/session'), {
      headers: authHeaders(),
    }),
  )
  return {
    token: result.token,
    user: {
      ...result.user,
      token: result.token,
    },
  }
}

export async function logoutSession() {
  return parseJson<{ ok: true }>(
    await fetch(withBase('/api/auth/logout'), {
      method: 'POST',
      headers: authHeaders(),
    }),
  )
}

export async function fetchBootstrap() {
  return parseJson<BootstrapResponse>(
    await fetch(withBase('/api/bootstrap'), {
      headers: authHeaders(),
    }),
  )
}

export async function fetchWeather(city: string) {
  const query = new URLSearchParams({ city })
  return parseJson<WeatherProfile>(await fetch(withBase(`/api/weather?${query.toString()}`)))
}

export async function saveSelectedCity(city: string) {
  return parseJson<{ selectedCity: string }>(
    await fetch(withBase('/api/selected-city'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ city }),
    }),
  )
}

export async function savePreferences(preferences: UserPreferences) {
  return parseJson<UserPreferences>(
    await fetch(withBase('/api/preferences'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(preferences),
    }),
  )
}

export async function fetchAvatarProfile() {
  return parseJson<AvatarProfile>(
    await fetch(withBase('/api/avatar-profile'), {
      headers: authHeaders(),
    }),
  )
}

export async function saveAvatarProfile(profile: AvatarProfile) {
  return parseJson<AvatarProfile>(
    await fetch(withBase('/api/avatar-profile'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(profile),
    }),
  )
}

export async function createWardrobeItem(item: WardrobeItem) {
  return parseJson<WardrobeItem>(
    await fetch(withBase('/api/wardrobe/items'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(item),
    }),
  )
}

export async function updateWardrobeItem(item: WardrobeItem) {
  return parseJson<WardrobeItem>(
    await fetch(withBase(`/api/wardrobe/items/${item.id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(item),
    }),
  )
}

export async function uploadWardrobeImage(
  dataUrl: string,
  processingMode: 'standard' | 'subject' = 'subject',
) {
  return parseJson<{ imageUrl: string; processingMode: 'standard' | 'subject' }>(
    await fetch(withBase('/api/uploads/image'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ dataUrl, processingMode }),
    }),
  )
}

export async function uploadAndAnalyzeGarment(
  dataUrl: string,
  processingMode: 'standard' | 'subject' = 'subject',
) {
  return parseJson<{
    imageUrl: string
    processingMode: 'standard' | 'subject'
    subjectStats: {
      extracted: boolean
      componentCount: number
      method?: 'ai_cutout' | 'local_cutout' | 'ai_studio_fallback' | 'fallback_original'
    }
    draft: null | {
      provider: string
      category: WardrobeItem['category']
      colorGroup: WardrobeItem['colorGroup']
      thickness: WardrobeItem['thickness']
      style: WardrobeItem['style']
      seasonFit: WardrobeItem['seasonFit']
      fitType: WardrobeItem['fitType']
      garmentLength: WardrobeItem['garmentLength']
      sleeveLength: WardrobeItem['sleeveLength']
      silhouette: WardrobeItem['silhouette']
      name: string
      note: string
      confidence: number
    }
    needsConfirmation: boolean
  }>(
    await fetch(withBase('/api/uploads/garment-analyze'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ dataUrl, processingMode }),
    }),
  )
}

export async function analyzeGarmentImage(dataUrl: string) {
  return parseJson<{
    draft: null | {
      provider: string
      category: WardrobeItem['category']
      colorGroup: WardrobeItem['colorGroup']
      thickness: WardrobeItem['thickness']
      style: WardrobeItem['style']
      seasonFit: WardrobeItem['seasonFit']
      fitType: WardrobeItem['fitType']
      garmentLength: WardrobeItem['garmentLength']
      sleeveLength: WardrobeItem['sleeveLength']
      silhouette: WardrobeItem['silhouette']
      name: string
      note: string
      confidence: number
    }
  }>(
    await fetch(withBase('/api/vision/garment-draft'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ dataUrl }),
    }),
  )
}

export async function updateWardrobeStatus(id: string, status: WardrobeItem['status']) {
  return parseJson<WardrobeItem>(
    await fetch(withBase(`/api/wardrobe/items/${id}/status`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ status }),
    }),
  )
}

export async function deleteWardrobeItem(id: string) {
  return parseJson<{ ok: true; id: string }>(
    await fetch(withBase(`/api/wardrobe/items/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    }),
  )
}

export async function recordLookWear(itemIds: string[], wornDate: string, look?: unknown) {
  return parseJson<{ ok: true; wardrobe: WardrobeItem[] }>(
    await fetch(withBase('/api/looks/wear'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ itemIds, wornDate, look }),
    }),
  )
}

export async function saveFavoriteLook(look: unknown) {
  return parseJson<SavedLook>(
    await fetch(withBase('/api/looks/favorites'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ look }),
    }),
  )
}

export async function deleteFavoriteLook(id: string) {
  return parseJson<{ ok: true; id: string }>(
    await fetch(withBase(`/api/looks/favorites/${id}`), {
      method: 'DELETE',
      headers: authHeaders(),
    }),
  )
}

export async function createTryOnSession(garmentItemId: string) {
  return parseJson<TryOnSession>(
    await fetch(withBase('/api/try-on/sessions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ garmentItemId }),
    }),
  )
}

export async function fetchTryOnSessions() {
  return parseJson<TryOnSession[]>(
    await fetch(withBase('/api/try-on/sessions'), {
      headers: authHeaders(),
    }),
  )
}

export async function generateTryOnPreview(sessionId: string) {
  return parseJson<TryOnSession>(
    await fetch(withBase(`/api/try-on/sessions/${sessionId}/generate`), {
      method: 'POST',
      headers: authHeaders(),
    }),
  )
}
