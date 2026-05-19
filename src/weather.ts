import type { CityOption, WeatherProfile } from './types'

function mapWeatherType(code: number): WeatherProfile['weatherType'] {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rainy'
  if ([1, 2, 3, 45, 48].includes(code)) return 'cloudy'
  if (code === 0) return 'sunny'
  return 'windy'
}

function mapWindLevel(speed: number): WeatherProfile['windLevel'] {
  if (speed >= 30) return 'high'
  if (speed >= 15) return 'medium'
  return 'low'
}

function mapUvLevel(value: number): WeatherProfile['uvLevel'] {
  if (value >= 7) return 'high'
  if (value >= 3) return 'medium'
  return 'low'
}

export async function fetchCityWeather(city: CityOption): Promise<WeatherProfile> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}` +
    `&longitude=${city.longitude}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
    '&timezone=Asia%2FShanghai&forecast_days=1'

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Weather request failed with ${response.status}`)
  }

  const data = (await response.json()) as {
    current: {
      temperature_2m: number
      apparent_temperature: number
      relative_humidity_2m: number
      weather_code: number
      wind_speed_10m: number
    }
    daily: {
      temperature_2m_max: number[]
      temperature_2m_min: number[]
      precipitation_probability_max: number[]
      uv_index_max: number[]
    }
  }

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
}
