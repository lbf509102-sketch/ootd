export const cityOptions = [
  {
    city: '嘉兴',
    latitude: 30.7462,
    longitude: 120.7555,
    fallbackWeather: {
      city: '嘉兴',
      temperature: 25,
      feelsLike: 26,
      weatherType: 'cloudy',
      windLevel: 'medium',
      humidity: 72,
      uvLevel: 'medium',
      tempGap: 7,
      rainProbability: 30,
    },
  },
  {
    city: '宁波',
    latitude: 29.8683,
    longitude: 121.544,
    fallbackWeather: {
      city: '宁波',
      temperature: 26,
      feelsLike: 28,
      weatherType: 'cloudy',
      windLevel: 'medium',
      humidity: 76,
      uvLevel: 'medium',
      tempGap: 6,
      rainProbability: 35,
    },
  },
  {
    city: '嵊州新昌',
    latitude: 29.54,
    longitude: 120.86,
    fallbackWeather: {
      city: '嵊州新昌',
      temperature: 25,
      feelsLike: 27,
      weatherType: 'cloudy',
      windLevel: 'low',
      humidity: 74,
      uvLevel: 'medium',
      tempGap: 6,
      rainProbability: 28,
    },
  },
]

const weatherCache = new Map()
const weatherCacheTtlMs = 10 * 60 * 1000

function mapWeatherType(code) {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rainy'
  if ([1, 2, 3, 45, 48].includes(code)) return 'cloudy'
  if (code === 0) return 'sunny'
  return 'windy'
}

function mapWindLevel(speed) {
  if (speed >= 30) return 'high'
  if (speed >= 15) return 'medium'
  return 'low'
}

function mapUvLevel(value) {
  if (value >= 7) return 'high'
  if (value >= 3) return 'medium'
  return 'low'
}

export async function fetchCityWeather(cityName) {
  const city = cityOptions.find((option) => option.city === cityName) ?? cityOptions[0]
  const cached = weatherCache.get(city.city)
  if (cached && Date.now() - cached.updatedAt < weatherCacheTtlMs) {
    return cached.weather
  }
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}` +
    `&longitude=${city.longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
    '&timezone=Asia%2FShanghai&forecast_days=1'

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`)

    const data = await response.json()
    const weather = {
      city: city.city,
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      weatherType: mapWeatherType(data.current.weather_code),
      windLevel: mapWindLevel(data.current.wind_speed_10m),
      humidity: Math.round(data.current.relative_humidity_2m),
      uvLevel: mapUvLevel(data.daily.uv_index_max[0] ?? 0),
      tempGap: Math.round(
        (data.daily.temperature_2m_max[0] ?? data.current.temperature_2m) -
          (data.daily.temperature_2m_min[0] ?? data.current.temperature_2m),
      ),
      rainProbability: Math.round(data.daily.precipitation_probability_max[0] ?? 0),
    }
    weatherCache.set(city.city, { weather, updatedAt: Date.now() })
    return weather
  } catch {
    return city.fallbackWeather
  }
}
