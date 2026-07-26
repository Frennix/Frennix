export type GeocodedPlace = {
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
};

function pickCity(address: NominatimAddress): string | null {
  const candidate =
    address.city ?? address.town ?? address.village ?? address.municipality ?? address.county;
  return candidate?.trim() || null;
}

function pickState(address: NominatimAddress): string | null {
  const candidate = address.state ?? address.region;
  return candidate?.trim() || null;
}

/** Reverse geocode coordinates to approximate city/state via OpenStreetMap Nominatim. */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<GeocodedPlace | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "Frennix/1.0 (training partner app)" },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { address?: NominatimAddress };
  const city = payload.address ? pickCity(payload.address) : null;
  if (!city) return null;

  return {
    city,
    state: payload.address ? pickState(payload.address) : null,
    latitude,
    longitude,
  };
}

/** Forward geocode a US city + state to approximate coordinates. */
export async function geocodeCityState(city: string, state: string): Promise<GeocodedPlace | null> {
  const query = [city.trim(), state.trim()].filter(Boolean).join(", ");
  if (!query) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "Frennix/1.0 (training partner app)" },
  });

  if (!response.ok) return null;

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    address?: NominatimAddress;
  }>;

  const hit = results[0];
  if (!hit) return null;

  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;

  const resolvedCity = hit.address ? pickCity(hit.address) : city.trim();
  if (!resolvedCity) return null;

  return {
    city: resolvedCity,
    state: hit.address ? (pickState(hit.address) ?? state.trim()) || null : state.trim() || null,
    latitude,
    longitude,
  };
}

export function formatCityState(city: string | null | undefined, state: string | null | undefined) {
  const parts = [city?.trim(), state?.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
