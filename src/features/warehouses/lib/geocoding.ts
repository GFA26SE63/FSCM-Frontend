/**
 * Geocoding & Reverse-geocoding service for Warehouse address and map picking synchronization.
 * Supports live OpenStreetMap Nominatim lookup with robust fallback to HCM City districts & reference landmarks.
 */

interface KnownLocation {
  name: string;
  address: string;
  lat: number;
  lng: number;
  keywords: string[];
}

const KNOWN_LOCATIONS: KnownLocation[] = [
  {
    name: 'Kho Thới An',
    address: 'P. Thới An, Q.12, TP. Hồ Chí Minh',
    lat: 10.8744,
    lng: 106.6511,
    keywords: ['thới an', 'thoi an', 'q12', 'quận 12', 'quan 12'],
  },
  {
    name: 'Kho Tân Chánh Hiệp',
    address: 'P. Tân Chánh Hiệp, Q.12, TP. Hồ Chí Minh',
    lat: 10.8632,
    lng: 106.6208,
    keywords: ['tân chánh hiệp', 'tan chanh hiep', 'tô ký', 'to ky'],
  },
  {
    name: 'Kho Gò Vấp',
    address: 'P. 14, Q. Gò Vấp, TP. Hồ Chí Minh',
    lat: 10.8421,
    lng: 106.6613,
    keywords: ['gò vấp', 'go vap', 'quang trung'],
  },
  {
    name: 'Kho Thủ Đức',
    address: 'P. Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh',
    lat: 10.8696,
    lng: 106.7791,
    keywords: ['thủ đức', 'thu duc', 'linh trung'],
  },
  {
    name: 'Kho Củ Chi',
    address: 'Xã Tân Thông Hội, H. Củ Chi, TP. Hồ Chí Minh',
    lat: 10.9741,
    lng: 106.4932,
    keywords: ['củ chi', 'cu chi', 'tân thông hội'],
  },
  {
    name: 'Kho Cần Giờ',
    address: 'Xã Bình Khánh, H. Cần Giờ, TP. Hồ Chí Minh',
    lat: 10.6081,
    lng: 106.7894,
    keywords: ['cần giờ', 'can gio', 'bình khánh'],
  },
  {
    name: 'Kho Hóc Môn',
    address: 'Xã Bà Điểm, H. Hóc Môn, TP. Hồ Chí Minh',
    lat: 10.8891,
    lng: 106.5912,
    keywords: ['hóc môn', 'hoc mon', 'bà điểm', 'ba diem', 'phan văn hớn'],
  },
  {
    name: 'Kho Bình Chánh',
    address: 'Xã Vĩnh Lộc A, H. Bình Chánh, TP. Hồ Chí Minh',
    lat: 10.7421,
    lng: 106.5612,
    keywords: ['bình chánh', 'binh chanh', 'vĩnh lộc'],
  },
  {
    name: 'Kho Tân Bình',
    address: 'P. 15, Q. Tân Bình, TP. Hồ Chí Minh',
    lat: 10.8012,
    lng: 106.6543,
    keywords: ['tân bình', 'tan binh', 'trường chinh', 'cộng hòa'],
  },
  {
    name: 'Khu vực Hiệp Thành Q12',
    address: 'P. Hiệp Thành, Q.12, TP. Hồ Chí Minh',
    lat: 10.8794,
    lng: 106.6412,
    keywords: ['hiệp thành', 'hiep thanh', 'nguyễn ảnh thủ'],
  },
  {
    name: 'Khu vực Thạnh Lộc Q12',
    address: 'P. Thạnh Lộc, Q.12, TP. Hồ Chí Minh',
    lat: 10.8873,
    lng: 106.6721,
    keywords: ['thạnh lộc', 'thanh loc', 'hà huy giáp'],
  },
];

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = lat1 - lat2;
  const dLng = lng1 - lng2;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Reverse-geocode latitude and longitude into a readable address.
 * Attempts OpenStreetMap Nominatim with a fast timeout and falls back to nearest HCM landmark.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const safeLat = Number(lat);
  const safeLng = Number(lng);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
    return '';
  }

  // 1. Try online reverse geocoding via OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${safeLat}&lon=${safeLng}&zoom=18&addressdetails=1&accept-language=vi`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const parts: string[] = [];
        const road = a.road || a.pedestrian || a.suburb || '';
        const ward = a.quarter || a.neighbourhood || a.ward || a.suburb || '';
        const district =
          a.city_district || a.district || a.county || a.town || '';
        const city = a.city || a.state || 'TP. Hồ Chí Minh';

        if (road && !parts.includes(road)) parts.push(road);
        if (ward && !parts.includes(ward)) parts.push(ward);
        if (district && !parts.includes(district)) parts.push(district);
        if (city && !parts.includes(city)) parts.push(city);

        if (parts.length >= 2) {
          return parts.join(', ');
        }
        if (data.display_name) {
          const rawParts = String(data.display_name).split(', ');
          return rawParts.slice(0, 4).join(', ');
        }
      }
    }
  } catch {
    // Fallback on network failure or abort
  }

  // 2. Fallback: match nearest known location in TP.HCM
  let nearest: KnownLocation = KNOWN_LOCATIONS[0];
  let minD = Infinity;
  for (const loc of KNOWN_LOCATIONS) {
    const d = calcDistance(safeLat, safeLng, loc.lat, loc.lng);
    if (d < minD) {
      minD = d;
      nearest = loc;
    }
  }

  return nearest.address;
}

/**
 * Forward-geocode address into [latitude, longitude].
 * Searches via Nominatim or falls back to known districts in TP.HCM.
 */
export async function forwardGeocode(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return null;

  // 1. Try matching known local keywords first for immediate response
  const lower = q.toLowerCase();
  for (const loc of KNOWN_LOCATIONS) {
    if (loc.keywords.some((k) => lower.includes(k))) {
      return { lat: loc.lat, lng: loc.lng };
    }
  }

  // 2. Try online geocoding via Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const query = q.includes('Hồ Chí Minh') || q.includes('HCM') ? q : `${q}, TP. Hồ Chí Minh`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=vi`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            lat: Math.round(lat * 10000) / 10000,
            lng: Math.round(lng * 10000) / 10000,
          };
        }
      }
    }
  } catch {
    // Fallback
  }

  return null;
}

