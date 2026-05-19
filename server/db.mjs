import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(dataDir, 'app.db')
const legacyJsonPath = path.join(dataDir, 'app-data.json')

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  if (columns.some((column) => column.name === columnName)) return
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
}

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    selected_city TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    phone TEXT PRIMARY KEY,
    preferred_styles TEXT NOT NULL,
    avoid_categories TEXT NOT NULL,
    avoid_colors TEXT NOT NULL,
    comfort_priority TEXT NOT NULL,
    default_scene TEXT NOT NULL,
    accepts_layering INTEGER NOT NULL,
    avoid_repeat_looks INTEGER NOT NULL,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS avatar_profiles (
    phone TEXT PRIMARY KEY,
    height_cm INTEGER NOT NULL,
    weight_kg INTEGER NOT NULL,
    gender_presentation TEXT NOT NULL,
    body_shape TEXT NOT NULL,
    shoulder_type TEXT NOT NULL,
    waist_type TEXT NOT NULL,
    hip_type TEXT NOT NULL,
    leg_length_type TEXT NOT NULL,
    try_on_photo_url TEXT,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wardrobe_items (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    color_group TEXT NOT NULL,
    thickness TEXT NOT NULL,
    style TEXT NOT NULL,
    status TEXT NOT NULL,
    season_fit TEXT NOT NULL,
    fit_type TEXT NOT NULL,
    garment_length TEXT,
    sleeve_length TEXT,
    silhouette TEXT,
    preference_score INTEGER NOT NULL,
    wear_count INTEGER NOT NULL,
    last_worn_at TEXT,
    is_disliked INTEGER NOT NULL,
    image_url TEXT,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS saved_looks (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS try_on_sessions (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    garment_item_id TEXT NOT NULL,
    person_image_url TEXT NOT NULL,
    garment_image_url TEXT NOT NULL,
    result_image_url TEXT,
    provider TEXT,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (phone) REFERENCES users(phone) ON DELETE CASCADE
  );
`)

ensureColumn('wardrobe_items', 'garment_length', 'TEXT')
ensureColumn('wardrobe_items', 'sleeve_length', 'TEXT')
ensureColumn('wardrobe_items', 'silhouette', 'TEXT')
ensureColumn('avatar_profiles', 'try_on_photo_url', 'TEXT')
ensureColumn('try_on_sessions', 'result_image_url', 'TEXT')
ensureColumn('try_on_sessions', 'provider', 'TEXT')

function normalizeLegacyData(raw) {
  if (raw.users) return raw
  return {
    users: {
      '13800138000': {
        phone: '13800138000',
        nickname: '默认用户',
        data: {
          selectedCity: raw.selectedCity ?? '上海',
          preferences: raw.preferences,
          wardrobe: raw.wardrobe,
        },
      },
    },
  }
}

function defaultWardrobe() {
  return [
    {
      id: 'item-1',
      name: '奶油白衬衫',
      category: 'top',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'commute',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 82,
      wearCount: 4,
      lastWornAt: '2026-05-10',
      isDisliked: false,
    },
    {
      id: 'item-2',
      name: '烟灰针织短袖',
      category: 'top',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'slim',
      preferenceScore: 88,
      wearCount: 7,
      lastWornAt: '2026-05-12',
      isDisliked: false,
    },
    {
      id: 'item-3',
      name: '浅蓝牛仔衬衫',
      category: 'top',
      colorGroup: 'denim',
      thickness: 'regular',
      style: 'casual',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'relaxed',
      preferenceScore: 70,
      wearCount: 3,
      lastWornAt: '2026-05-08',
      isDisliked: false,
    },
    {
      id: 'item-4',
      name: '雾蓝西装外套',
      category: 'outerwear',
      colorGroup: 'blue',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 86,
      wearCount: 5,
      lastWornAt: '2026-05-09',
      isDisliked: false,
    },
    {
      id: 'item-5',
      name: '米杏轻薄开衫',
      category: 'outerwear',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 77,
      wearCount: 6,
      lastWornAt: '2026-05-06',
      isDisliked: false,
    },
    {
      id: 'item-6',
      name: '炭黑直筒西裤',
      category: 'bottom',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 91,
      wearCount: 8,
      lastWornAt: '2026-05-11',
      isDisliked: false,
    },
    {
      id: 'item-7',
      name: '燕麦A字半裙',
      category: 'bottom',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'summer',
      fitType: 'regular',
      preferenceScore: 80,
      wearCount: 2,
      lastWornAt: '2026-05-07',
      isDisliked: false,
    },
    {
      id: 'item-8',
      name: '深蓝锥形牛仔裤',
      category: 'bottom',
      colorGroup: 'denim',
      thickness: 'regular',
      style: 'casual',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 74,
      wearCount: 5,
      lastWornAt: '2026-05-13',
      isDisliked: false,
    },
    {
      id: 'item-9',
      name: '奶油白连衣裙',
      category: 'dress',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'summer',
      fitType: 'regular',
      preferenceScore: 75,
      wearCount: 2,
      lastWornAt: '2026-05-04',
      isDisliked: false,
    },
    {
      id: 'item-10',
      name: '黑色乐福鞋',
      category: 'shoes',
      colorGroup: 'black_white_gray',
      thickness: 'regular',
      style: 'commute',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 90,
      wearCount: 10,
      lastWornAt: '2026-05-12',
      isDisliked: false,
    },
    {
      id: 'item-11',
      name: '白色简约板鞋',
      category: 'shoes',
      colorGroup: 'black_white_gray',
      thickness: 'light',
      style: 'casual',
      status: 'ready',
      seasonFit: 'all_season',
      fitType: 'regular',
      preferenceScore: 76,
      wearCount: 9,
      lastWornAt: '2026-05-13',
      isDisliked: false,
    },
    {
      id: 'item-12',
      name: '浅杏低跟单鞋',
      category: 'shoes',
      colorGroup: 'khaki_brown',
      thickness: 'light',
      style: 'refined',
      status: 'ready',
      seasonFit: 'spring_autumn',
      fitType: 'regular',
      preferenceScore: 84,
      wearCount: 4,
      lastWornAt: '2026-05-09',
      isDisliked: false,
    },
  ]
}

function defaultAvatarProfile() {
  return {
    heightCm: 165,
    weightKg: 55,
    genderPresentation: 'feminine',
    bodyShape: 'balanced',
    shoulderType: 'regular',
    waistType: 'regular',
    hipType: 'regular',
    legLengthType: 'regular',
    tryOnPhotoUrl: null,
  }
}

function inferGarmentMeta(item) {
  const fitType = item.fitType ?? 'regular'
  const silhouette =
    fitType === 'slim' ? 'fitted' : fitType === 'relaxed' ? 'relaxed' : item.category === 'dress' ? 'a_line' : 'straight'

  if (item.category === 'top') {
    return { garmentLength: 'regular', sleeveLength: 'short', silhouette }
  }

  if (item.category === 'outerwear') {
    return { garmentLength: 'long', sleeveLength: 'long', silhouette }
  }

  if (item.category === 'dress') {
    return { garmentLength: 'midi', sleeveLength: 'short', silhouette: item.fitType === 'slim' ? 'fitted' : 'a_line' }
  }

  if (item.category === 'bottom') {
    return { garmentLength: 'regular', sleeveLength: 'na', silhouette }
  }

  return { garmentLength: 'short', sleeveLength: 'na', silhouette: 'straight' }
}

function normalizeWardrobeItem(item) {
  const inferred = inferGarmentMeta(item)
  return {
    ...item,
    isDisliked: Boolean(item.isDisliked),
    garmentLength: item.garmentLength ?? inferred.garmentLength,
    sleeveLength: item.sleeveLength ?? inferred.sleeveLength,
    silhouette: item.silhouette ?? inferred.silhouette,
  }
}

function seedFromLegacyOrDefault() {
  let users = {}
  if (existsSync(legacyJsonPath)) {
    const raw = JSON.parse(readFileSync(legacyJsonPath, 'utf8'))
    users = normalizeLegacyData(raw).users
  } else {
    users = {
      '13800138000': {
        phone: '13800138000',
        nickname: '默认用户',
        data: {
          selectedCity: '上海',
          preferences: {
            preferredStyles: ['commute', 'refined'],
            avoidCategories: [],
            avoidColors: [],
            comfortPriority: 'versatile_first',
            defaultScene: 'commute',
            acceptsLayering: true,
            avoidRepeatLooks: true,
          },
          wardrobe: defaultWardrobe(),
        },
      },
    }
  }

  for (const user of Object.values(users)) {
    insertUserRecord(user.phone, user.nickname, user.data.selectedCity)
    upsertPreferences(user.phone, user.data.preferences)
    upsertAvatarProfile(user.phone, user.data.avatarProfile ?? defaultAvatarProfile())
    replaceWardrobe(user.phone, user.data.wardrobe ?? [])
  }
}

const insertUserStmt = db.prepare(
  'INSERT OR IGNORE INTO users (phone, nickname, selected_city) VALUES (?, ?, ?)',
)
const upsertUserStmt = db.prepare(
  `INSERT INTO users (phone, nickname, selected_city)
   VALUES (?, ?, ?)
   ON CONFLICT(phone) DO UPDATE SET nickname=excluded.nickname, selected_city=excluded.selected_city`,
)
const getUserStmt = db.prepare('SELECT phone, nickname, selected_city AS selectedCity FROM users WHERE phone = ?')
const upsertPreferencesStmt = db.prepare(
  `INSERT INTO preferences (
    phone, preferred_styles, avoid_categories, avoid_colors, comfort_priority, default_scene, accepts_layering, avoid_repeat_looks
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(phone) DO UPDATE SET
    preferred_styles=excluded.preferred_styles,
    avoid_categories=excluded.avoid_categories,
    avoid_colors=excluded.avoid_colors,
    comfort_priority=excluded.comfort_priority,
    default_scene=excluded.default_scene,
    accepts_layering=excluded.accepts_layering,
    avoid_repeat_looks=excluded.avoid_repeat_looks`,
)
const getPreferencesStmt = db.prepare(
  `SELECT preferred_styles, avoid_categories, avoid_colors, comfort_priority,
          default_scene, accepts_layering, avoid_repeat_looks
   FROM preferences WHERE phone = ?`,
)
const upsertAvatarProfileStmt = db.prepare(
  `INSERT INTO avatar_profiles (
    phone, height_cm, weight_kg, gender_presentation, body_shape, shoulder_type, waist_type, hip_type, leg_length_type, try_on_photo_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(phone) DO UPDATE SET
    height_cm=excluded.height_cm,
    weight_kg=excluded.weight_kg,
    gender_presentation=excluded.gender_presentation,
    body_shape=excluded.body_shape,
    shoulder_type=excluded.shoulder_type,
    waist_type=excluded.waist_type,
    hip_type=excluded.hip_type,
    leg_length_type=excluded.leg_length_type,
    try_on_photo_url=excluded.try_on_photo_url`,
)
const getAvatarProfileStmt = db.prepare(
  `SELECT
      height_cm AS heightCm,
      weight_kg AS weightKg,
      gender_presentation AS genderPresentation,
      body_shape AS bodyShape,
      shoulder_type AS shoulderType,
      waist_type AS waistType,
      hip_type AS hipType,
      leg_length_type AS legLengthType,
      try_on_photo_url AS tryOnPhotoUrl
   FROM avatar_profiles
   WHERE phone = ?`,
)
const deleteWardrobeStmt = db.prepare('DELETE FROM wardrobe_items WHERE phone = ?')
const insertWardrobeStmt = db.prepare(
  `INSERT INTO wardrobe_items (
    id, phone, name, category, color_group, thickness, style, status,
    season_fit, fit_type, garment_length, sleeve_length, silhouette, preference_score, wear_count, last_worn_at, is_disliked, image_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const getWardrobeStmt = db.prepare(
  `SELECT id, name, category, color_group AS colorGroup, thickness, style, status,
          season_fit AS seasonFit, fit_type AS fitType, garment_length AS garmentLength,
          sleeve_length AS sleeveLength, silhouette, preference_score AS preferenceScore,
          wear_count AS wearCount, last_worn_at AS lastWornAt, is_disliked AS isDisliked, image_url AS imageUrl
   FROM wardrobe_items WHERE phone = ?
   ORDER BY rowid DESC`,
)
const getWardrobeItemStmt = db.prepare(
  `SELECT id, name, category, color_group AS colorGroup, thickness, style, status,
          season_fit AS seasonFit, fit_type AS fitType, garment_length AS garmentLength,
          sleeve_length AS sleeveLength, silhouette, preference_score AS preferenceScore,
          wear_count AS wearCount, last_worn_at AS lastWornAt, is_disliked AS isDisliked, image_url AS imageUrl
   FROM wardrobe_items WHERE phone = ? AND id = ?`,
)
const updateCityStmt = db.prepare('UPDATE users SET selected_city = ? WHERE phone = ?')
const updateWardrobeStatusStmt = db.prepare(
  'UPDATE wardrobe_items SET status = ? WHERE phone = ? AND id = ?',
)
const updateWardrobeItemStmt = db.prepare(
  `UPDATE wardrobe_items
   SET name = ?,
       category = ?,
       color_group = ?,
       thickness = ?,
       style = ?,
       status = ?,
       season_fit = ?,
       fit_type = ?,
       garment_length = ?,
       sleeve_length = ?,
       silhouette = ?,
       image_url = ?
   WHERE phone = ? AND id = ?`,
)
const deleteWardrobeItemStmt = db.prepare('DELETE FROM wardrobe_items WHERE phone = ? AND id = ?')
const updateWearStmt = db.prepare(
  `UPDATE wardrobe_items
   SET wear_count = wear_count + 1,
       last_worn_at = ?,
       preference_score = MIN(100, preference_score + 2)
   WHERE phone = ? AND id = ?`,
)
const insertOtpStmt = db.prepare(
  `INSERT INTO otp_codes (phone, code, expires_at)
   VALUES (?, ?, ?)
   ON CONFLICT(phone) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at`,
)
const getOtpStmt = db.prepare('SELECT phone, code, expires_at AS expiresAt FROM otp_codes WHERE phone = ?')
const deleteOtpStmt = db.prepare('DELETE FROM otp_codes WHERE phone = ?')
const insertSessionStmt = db.prepare(
  `INSERT INTO sessions (token, phone, created_at) VALUES (?, ?, ?)`,
)
const getSessionStmt = db.prepare(
  'SELECT token, phone, created_at AS createdAt FROM sessions WHERE token = ?',
)
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE token = ?')
const insertSavedLookStmt = db.prepare(
  `INSERT INTO saved_looks (id, phone, kind, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
)
const getSavedLooksStmt = db.prepare(
  `SELECT id, kind, payload, created_at AS createdAt
   FROM saved_looks WHERE phone = ? AND kind = ?
   ORDER BY created_at DESC`,
)
const deleteSavedLookStmt = db.prepare(
  'DELETE FROM saved_looks WHERE phone = ? AND kind = ? AND id = ?',
)
const insertTryOnSessionStmt = db.prepare(
  `INSERT INTO try_on_sessions (
    id, phone, garment_item_id, person_image_url, garment_image_url, result_image_url, provider, status, note, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const getTryOnSessionsStmt = db.prepare(
  `SELECT
      id,
      garment_item_id AS garmentItemId,
      person_image_url AS personImageUrl,
      garment_image_url AS garmentImageUrl,
      result_image_url AS resultImageUrl,
      provider,
      status,
      note,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM try_on_sessions
   WHERE phone = ?
   ORDER BY created_at DESC`,
)
const getTryOnSessionStmt = db.prepare(
  `SELECT
      id,
      garment_item_id AS garmentItemId,
      person_image_url AS personImageUrl,
      garment_image_url AS garmentImageUrl,
      result_image_url AS resultImageUrl,
      provider,
      status,
      note,
      created_at AS createdAt,
      updated_at AS updatedAt
   FROM try_on_sessions
   WHERE phone = ? AND id = ?`,
)
const updateTryOnSessionStmt = db.prepare(
  `UPDATE try_on_sessions
   SET result_image_url = ?,
       provider = ?,
       status = ?,
       note = ?,
       updated_at = ?
   WHERE phone = ? AND id = ?`,
)

function serializeArray(value) {
  return JSON.stringify(value ?? [])
}

function parseArray(value) {
  return JSON.parse(value ?? '[]')
}

function rowToPreferences(row) {
  return {
    preferredStyles: parseArray(row.preferred_styles),
    avoidCategories: parseArray(row.avoid_categories),
    avoidColors: parseArray(row.avoid_colors),
    comfortPriority: row.comfort_priority,
    defaultScene: row.default_scene,
    acceptsLayering: Boolean(row.accepts_layering),
    avoidRepeatLooks: Boolean(row.avoid_repeat_looks),
  }
}

export function insertUserRecord(phone, nickname, selectedCity = '上海') {
  insertUserStmt.run(phone, nickname, selectedCity)
}

export function upsertUser(phone, nickname, selectedCity = '上海') {
  upsertUserStmt.run(phone, nickname, selectedCity)
}

export function getUser(phone) {
  return getUserStmt.get(phone) ?? null
}

export function getUserBundle(phone) {
  const user = getUser(phone)
  if (!user) return null
  const preferenceRow = getPreferencesStmt.get(phone)
  const avatarProfile = getAvatarProfile(phone)
  return {
    user,
    preferences: preferenceRow
      ? rowToPreferences(preferenceRow)
      : {
          preferredStyles: ['commute', 'refined'],
          avoidCategories: [],
          avoidColors: [],
          comfortPriority: 'versatile_first',
          defaultScene: 'commute',
          acceptsLayering: true,
          avoidRepeatLooks: true,
        },
    avatarProfile,
    wardrobe: getWardrobeStmt.all(phone).map((item) => normalizeWardrobeItem(item)),
    history: getSavedLooks(phone, 'history'),
    favorites: getSavedLooks(phone, 'favorite'),
    tryOnSessions: getTryOnSessions(phone),
  }
}

export function upsertPreferences(phone, preferences) {
  upsertPreferencesStmt.run(
    phone,
    serializeArray(preferences.preferredStyles),
    serializeArray(preferences.avoidCategories),
    serializeArray(preferences.avoidColors),
    preferences.comfortPriority,
    preferences.defaultScene,
    preferences.acceptsLayering ? 1 : 0,
    preferences.avoidRepeatLooks ? 1 : 0,
  )
}

export function getAvatarProfile(phone) {
  return getAvatarProfileStmt.get(phone) ?? defaultAvatarProfile()
}

export function upsertAvatarProfile(phone, profile) {
  upsertAvatarProfileStmt.run(
    phone,
    profile.heightCm,
    profile.weightKg,
    profile.genderPresentation,
    profile.bodyShape,
    profile.shoulderType,
    profile.waistType,
    profile.hipType,
    profile.legLengthType,
    profile.tryOnPhotoUrl ?? null,
  )
}

export function replaceWardrobe(phone, wardrobe) {
  db.exec('BEGIN')
  try {
    deleteWardrobeStmt.run(phone)
    for (const item of wardrobe) {
      const normalized = normalizeWardrobeItem(item)
      insertWardrobeStmt.run(
        normalized.id,
        phone,
        normalized.name,
        normalized.category,
        normalized.colorGroup,
        normalized.thickness,
        normalized.style,
        normalized.status,
        normalized.seasonFit,
        normalized.fitType,
        normalized.garmentLength,
        normalized.sleeveLength,
        normalized.silhouette,
        normalized.preferenceScore,
        normalized.wearCount,
        normalized.lastWornAt ?? null,
        normalized.isDisliked ? 1 : 0,
        normalized.imageUrl ?? null,
      )
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function addWardrobeItem(phone, item) {
  const normalized = normalizeWardrobeItem(item)
  insertWardrobeStmt.run(
    normalized.id,
    phone,
    normalized.name,
    normalized.category,
    normalized.colorGroup,
    normalized.thickness,
    normalized.style,
    normalized.status,
    normalized.seasonFit,
    normalized.fitType,
    normalized.garmentLength,
    normalized.sleeveLength,
    normalized.silhouette,
    normalized.preferenceScore,
    normalized.wearCount,
    normalized.lastWornAt ?? null,
    normalized.isDisliked ? 1 : 0,
    normalized.imageUrl ?? null,
  )
}

export function getWardrobeItem(phone, id) {
  const item = getWardrobeItemStmt.get(phone, id)
  return item ? normalizeWardrobeItem(item) : null
}

export function updateSelectedCity(phone, city) {
  updateCityStmt.run(city, phone)
}

export function updateWardrobeStatus(phone, id, status) {
  updateWardrobeStatusStmt.run(status, phone, id)
}

export function updateWardrobeItem(phone, item) {
  const normalized = normalizeWardrobeItem(item)
  updateWardrobeItemStmt.run(
    normalized.name,
    normalized.category,
    normalized.colorGroup,
    normalized.thickness,
    normalized.style,
    normalized.status,
    normalized.seasonFit,
    normalized.fitType,
    normalized.garmentLength,
    normalized.sleeveLength,
    normalized.silhouette,
    normalized.imageUrl ?? null,
    phone,
    normalized.id,
  )
}

export function deleteWardrobeItem(phone, id) {
  deleteWardrobeItemStmt.run(phone, id)
}

export function recordLookWear(phone, itemIds, wornDate) {
  db.exec('BEGIN')
  try {
    for (const id of itemIds) {
      updateWearStmt.run(wornDate, phone, id)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function saveOtp(phone, code, expiresAt) {
  insertOtpStmt.run(phone, code, expiresAt)
}

export function getOtp(phone) {
  return getOtpStmt.get(phone) ?? null
}

export function deleteOtp(phone) {
  deleteOtpStmt.run(phone)
}

export function createSession(token, phone, createdAt) {
  insertSessionStmt.run(token, phone, createdAt)
}

export function getSession(token) {
  return getSessionStmt.get(token) ?? null
}

export function deleteSession(token) {
  deleteSessionStmt.run(token)
}

export function getDatabasePath() {
  return dbPath
}

export function addSavedLook(phone, kind, look) {
  const now = new Date().toISOString()
  const id = `${kind}-${crypto.randomUUID()}`
  insertSavedLookStmt.run(id, phone, kind, JSON.stringify(look), now)
  return { id, kind, look, createdAt: now }
}

export function getSavedLooks(phone, kind) {
  return getSavedLooksStmt.all(phone, kind).map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    look: JSON.parse(entry.payload),
    createdAt: entry.createdAt,
  }))
}

export function removeSavedLook(phone, kind, id) {
  deleteSavedLookStmt.run(phone, kind, id)
}

export function addTryOnSession(phone, payload) {
  const now = new Date().toISOString()
  const id = `tryon-${crypto.randomUUID()}`
  insertTryOnSessionStmt.run(
    id,
    phone,
    payload.garmentItemId,
    payload.personImageUrl,
    payload.garmentImageUrl,
    payload.resultImageUrl ?? null,
    payload.provider ?? null,
    payload.status,
    payload.note,
    now,
    now,
  )
  return {
    id,
    garmentItemId: payload.garmentItemId,
    personImageUrl: payload.personImageUrl,
    garmentImageUrl: payload.garmentImageUrl,
    resultImageUrl: payload.resultImageUrl ?? null,
    provider: payload.provider ?? null,
    status: payload.status,
    note: payload.note,
    createdAt: now,
    updatedAt: now,
  }
}

export function getTryOnSessions(phone) {
  return getTryOnSessionsStmt.all(phone)
}

export function getTryOnSession(phone, id) {
  return getTryOnSessionStmt.get(phone, id) ?? null
}

export function updateTryOnSession(phone, id, payload) {
  const now = new Date().toISOString()
  updateTryOnSessionStmt.run(
    payload.resultImageUrl ?? null,
    payload.provider ?? null,
    payload.status,
    payload.note,
    now,
    phone,
    id,
  )
  return getTryOnSession(phone, id)
}

const countUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
if (countUsers === 0) {
  seedFromLegacyOrDefault()
}
