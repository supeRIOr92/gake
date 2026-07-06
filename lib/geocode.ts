interface GeocodeResult {
  lat: number;
  lon: number;
  countryCode: string;
}

export async function geocodeCity(cityName: string): Promise<GeocodeResult | null> {
  const cleanName = cityName.split(',')[0].trim();
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanName)}&count=1&language=en&format=json`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;
  return {
    lat: result.latitude,
    lon: result.longitude,
    countryCode: result.country_code,
  };
}
