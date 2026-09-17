'use client';

interface WeatherData {
  temperature_c: number;
  rainfall_mm_hr: number;
  condition: string;
  humidity_pct: number;
  forecast_24h?: string;
}

interface WeatherWidgetProps {
  zoneName: string;
  weatherData?: WeatherData;
}

function getWeatherEmoji(condition: string): string {
  const c = (condition || '').toLowerCase();
  if (c.includes('thunder') || c.includes('storm')) return '⛈️';
  if (c.includes('heavy rain') || c.includes('heavy_rain')) return '🌧️';
  if (c.includes('rain') || c.includes('shower')) return '🌦️';
  if (c.includes('cloud') || c.includes('overcast')) return '☁️';
  if (c.includes('fog') || c.includes('mist')) return '🌫️';
  if (c.includes('partly') || c.includes('partial')) return '🌤️';
  if (c.includes('clear') || c.includes('sunny')) return '☀️';
  return '🌤️';
}

function getRainfallRisk(rainfall: number): { text: string; color: string; contribution: number } {
  if (rainfall > 30) return { text: 'EXTREME', color: 'text-red-400', contribution: 35 };
  if (rainfall > 15) return { text: 'HIGH', color: 'text-orange-400', contribution: 25 };
  if (rainfall > 5) return { text: 'MODERATE', color: 'text-yellow-400', contribution: 15 };
  return { text: 'LOW', color: 'text-green-400', contribution: 5 };
}

export default function WeatherWidget({ zoneName, weatherData }: WeatherWidgetProps) {
  if (!weatherData) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="text-gray-500 text-sm text-center py-2">No weather data for {zoneName}</div>
      </div>
    );
  }

  const emoji = getWeatherEmoji(weatherData.condition);
  const rainfallRisk = getRainfallRisk(weatherData.rainfall_mm_hr);

  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-gray-400 text-xs uppercase tracking-wider">{zoneName}</div>
          <div className="text-white font-semibold text-sm mt-0.5">{weatherData.condition}</div>
        </div>
        <div className="text-4xl">{emoji}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-500 text-xs">🌡️ Temperature</div>
          <div className="text-white font-bold">{weatherData.temperature_c}°C</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-gray-500 text-xs">💧 Humidity</div>
          <div className="text-white font-bold">{weatherData.humidity_pct}%</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 col-span-2">
          <div className="text-gray-500 text-xs mb-1">🌧️ Rainfall Rate</div>
          <div className="flex items-center justify-between">
            <span className="text-white font-bold">{weatherData.rainfall_mm_hr} mm/hr</span>
            <span className={`text-xs font-bold ${rainfallRisk.color}`}>{rainfallRisk.text}</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min((weatherData.rainfall_mm_hr / 40) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-orange-900/30 border border-orange-800/50 rounded-lg p-2">
        <div className="text-orange-300 text-xs">
          ⚠️ Rainfall contributes <span className="font-bold">+{rainfallRisk.contribution}</span> to road risk score
        </div>
      </div>

      {weatherData.forecast_24h && (
        <div className="text-gray-400 text-xs">
          📅 24h: {weatherData.forecast_24h}
        </div>
      )}
    </div>
  );
}
