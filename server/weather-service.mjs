export const cityOptions = [
  {
    city: '上海',
    latitude: 31.2222,
    longitude: 121.4581,
    fallbackWeather: {
      city: '上海',
      temperature: 24,
      feelsLike: 23,
      weatherType: 'cloudy',
      windLevel: 'medium',
      humidity: 66,
      uvLevel: 'high',
      tempGap: 7,
      rainProbability: 25,
    },
  },
  {
    city: '北京',
    latitude: 39.9042,
    longitude: 116.4074,
    fallbackWeather: {
      city: '北京',
      temperature: 28,
      feelsLike: 29,
      weatherType: 'sunny',
      windLevel: 'low',
      humidity: 42,
      uvLevel: 'high',
      tempGap: 9,
      rainProbability: 5,
    },
  },
  {
    city: '广州',
    latitude: 23.1291,
    longitude: 113.2644,
    fallbackWeather: {
      city: '广州',
      temperature: 31,
      feelsLike: 34,
      weatherType: 'rainy',
      windLevel: 'medium',
      humidity: 84,
      uvLevel: 'medium',
      tempGap: 4,
      rainProbability: 72,
    },
  },
]

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
    return {
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
  } catch {
    return city.fallbackWeather
  }
}
