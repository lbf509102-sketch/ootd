import {
  bodyShapeLabels,
  comfortOptions,
  genderPresentationLabels,
  hipTypeLabels,
  legLengthLabels,
  sceneLabels,
  shoulderTypeLabels,
  styleLabels,
  waistTypeLabels,
} from '../app-constants'
import type { AvatarProfile, BodyShape, ComfortPriority, GenderPresentation, HipType, LegLengthType, Scene, ShoulderType, StyleTag, UserPreferences, UserSession, WaistType } from '../types'

type Props = {
  avatarPhotoUploading: boolean
  avatarProfile: AvatarProfile
  avatarSaving: boolean
  favoriteLooksCount: number
  handleLogout: () => void
  handleSaveAvatarProfile: () => void
  historyLooksCount: number
  handleTryOnPhotoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  openTryOnPhotoPicker: () => void
  preferences: UserPreferences
  session: UserSession
  setScene: (scene: Scene) => void
  tryOnReadiness: {
    canStartPreview: boolean
    dresses: number
    hasTryOnPhoto: boolean
    outerwear: number
    readyCount: number
    shoes: number
    tops: number
    bottoms: number
  }
  updateAvatarField: <Key extends keyof AvatarProfile>(key: Key, value: AvatarProfile[Key]) => void
  updatePreferences: (nextPreferences: UserPreferences) => void
  wardrobeCount: number
}

export function ProfileSettingsPanel({
  avatarPhotoUploading,
  avatarProfile,
  avatarSaving,
  favoriteLooksCount,
  handleLogout,
  handleSaveAvatarProfile,
  historyLooksCount,
  handleTryOnPhotoUpload,
  openTryOnPhotoPicker,
  preferences,
  session,
  setScene,
  tryOnReadiness,
  updateAvatarField,
  updatePreferences,
  wardrobeCount,
}: Props) {
  return (
    <>
      <article className="settings-card">
        <h3>喜欢的风格</h3>
        <div className="toggle-list">
          {Object.entries(styleLabels).map(([value, label]) => {
            const typedValue = value as StyleTag
            const active = preferences.preferredStyles.includes(typedValue)
            return (
              <button
                key={value}
                className={active ? 'active' : ''}
                onClick={() =>
                  updatePreferences({
                    ...preferences,
                    preferredStyles: active
                      ? preferences.preferredStyles.filter((entry) => entry !== typedValue)
                      : [...preferences.preferredStyles, typedValue].slice(-3),
                  })
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </article>

      <article className="settings-card">
        <h3>舒适优先项</h3>
        <select
          value={preferences.comfortPriority}
          onChange={(event) =>
            updatePreferences({
              ...preferences,
              comfortPriority: event.target.value as ComfortPriority,
            })
          }
        >
          {Object.entries(comfortOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </article>

      <article className="settings-card">
        <h3>默认场景</h3>
        <select
          value={preferences.defaultScene}
          onChange={(event) => {
            const nextScene = event.target.value as Scene
            updatePreferences({ ...preferences, defaultScene: nextScene })
            setScene(nextScene)
          }}
        >
          {Object.entries(sceneLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </article>

      <article className="settings-card">
        <h3>推荐设置</h3>
        <div className="checkbox-list">
          <label>
            <input
              type="checkbox"
              checked={preferences.acceptsLayering}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  acceptsLayering: event.target.checked,
                })
              }
            />
            接受叠穿
          </label>
          <label>
            <input
              type="checkbox"
              checked={preferences.avoidRepeatLooks}
              onChange={(event) =>
                updatePreferences({
                  ...preferences,
                  avoidRepeatLooks: event.target.checked,
                })
              }
            />
            尽量避免重复推荐
          </label>
        </div>
      </article>

      <article className="settings-card">
        <div className="settings-card-head">
          <div>
            <h3>我的身材档案</h3>
            <p>先把基础体型填完整，后续推荐和展示都会更贴近你。</p>
          </div>
          <button className="secondary" type="button" onClick={handleSaveAvatarProfile} disabled={avatarSaving}>
            {avatarSaving ? '保存中…' : '保存档案'}
          </button>
        </div>

        <input id="try-on-photo-input" hidden accept="image/*" type="file" onChange={handleTryOnPhotoUpload} />

        <div className="try-on-photo-card">
          <div className="try-on-photo-copy">
            <strong>本人试穿参考照</strong>
            <p>建议上传一张正面、站姿自然、背景尽量干净的全身照，后面接试衣会更稳。</p>
          </div>
          <div className="try-on-photo-preview">
            {avatarProfile.tryOnPhotoUrl ? <img src={avatarProfile.tryOnPhotoUrl} alt="试穿参考照" /> : <span>还没有上传试穿参考照</span>}
          </div>
          <button className="ghost" type="button" onClick={openTryOnPhotoPicker} disabled={avatarPhotoUploading}>
            {avatarPhotoUploading ? '上传中…' : avatarProfile.tryOnPhotoUrl ? '更换参考照' : '上传参考照'}
          </button>
        </div>

        <div className="avatar-profile-grid">
          <label>
            <span>身高（cm）</span>
            <input
              type="number"
              min={130}
              max={220}
              value={avatarProfile.heightCm}
              onChange={(event) => updateAvatarField('heightCm', Number(event.target.value || 0))}
            />
          </label>

          <label>
            <span>体重（kg）</span>
            <input
              type="number"
              min={30}
              max={180}
              value={avatarProfile.weightKg}
              onChange={(event) => updateAvatarField('weightKg', Number(event.target.value || 0))}
            />
          </label>

          <label>
            <span>风格呈现</span>
            <select
              value={avatarProfile.genderPresentation}
              onChange={(event) => updateAvatarField('genderPresentation', event.target.value as GenderPresentation)}
            >
              {Object.entries(genderPresentationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>整体身形</span>
            <select value={avatarProfile.bodyShape} onChange={(event) => updateAvatarField('bodyShape', event.target.value as BodyShape)}>
              {Object.entries(bodyShapeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>肩部观感</span>
            <select value={avatarProfile.shoulderType} onChange={(event) => updateAvatarField('shoulderType', event.target.value as ShoulderType)}>
              {Object.entries(shoulderTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>腰线观感</span>
            <select value={avatarProfile.waistType} onChange={(event) => updateAvatarField('waistType', event.target.value as WaistType)}>
              {Object.entries(waistTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>胯臀观感</span>
            <select value={avatarProfile.hipType} onChange={(event) => updateAvatarField('hipType', event.target.value as HipType)}>
              {Object.entries(hipTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>腿长比例</span>
            <select value={avatarProfile.legLengthType} onChange={(event) => updateAvatarField('legLengthType', event.target.value as LegLengthType)}>
              {Object.entries(legLengthLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="avatar-profile-summary">
          <span>{avatarProfile.heightCm} cm / {avatarProfile.weightKg} kg</span>
          <span>{bodyShapeLabels[avatarProfile.bodyShape]}</span>
          <span>{shoulderTypeLabels[avatarProfile.shoulderType]}肩</span>
          <span>{waistTypeLabels[avatarProfile.waistType]}腰线</span>
          <span>{hipTypeLabels[avatarProfile.hipType]}胯臀</span>
        </div>
      </article>

      <article className="settings-card">
        <div className="settings-card-head">
          <div>
            <h3>试穿准备度</h3>
            <p>{tryOnReadiness.canStartPreview ? '基础素材已经够用了，可以直接开始生成预览。' : '再补一点素材，就能更顺手地看上身效果。'}</p>
          </div>
          <span className={`readiness-pill${tryOnReadiness.canStartPreview ? ' ready' : ''}`}>
            {tryOnReadiness.canStartPreview ? '已可开始' : '继续补素材'}
          </span>
        </div>

        <div className="saved-metrics">
          <div className="metric-card">
            <strong>{tryOnReadiness.hasTryOnPhoto ? '已上传' : '未上传'}</strong>
            <span>本人参考照</span>
          </div>
          <div className="metric-card">
            <strong>{tryOnReadiness.readyCount}</strong>
            <span>件可试穿单品</span>
          </div>
          <div className="metric-card">
            <strong>{tryOnReadiness.tops + tryOnReadiness.dresses}</strong>
            <span>上装/裙装</span>
          </div>
        </div>

        <div className="avatar-profile-summary">
          <span>上衣 {tryOnReadiness.tops} 件</span>
          <span>下装 {tryOnReadiness.bottoms} 件</span>
          <span>连衣裙 {tryOnReadiness.dresses} 件</span>
          <span>外套 {tryOnReadiness.outerwear} 件</span>
          <span>鞋子 {tryOnReadiness.shoes} 双</span>
        </div>
      </article>

      <article className="settings-card">
        <h3>当前账号</h3>
        <p>{session.nickname}</p>
        <p>{session.phone}</p>
        <button className="ghost" onClick={handleLogout}>
          退出登录
        </button>
      </article>

      <article className="settings-card">
        <h3>使用概览</h3>
        <div className="saved-metrics">
          <div className="metric-card">
            <strong>{wardrobeCount}</strong>
            <span>件衣物</span>
          </div>
          <div className="metric-card">
            <strong>{historyLooksCount}</strong>
            <span>次穿搭记录</span>
          </div>
          <div className="metric-card">
            <strong>{favoriteLooksCount}</strong>
            <span>套收藏搭配</span>
          </div>
        </div>
      </article>
    </>
  )
}
