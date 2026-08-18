import type * as Leaflet from 'leaflet';

let leafletLoadPromise: Promise<typeof Leaflet> | null = null;
let googleMapsLoadPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<typeof Leaflet> {
  loadLeafletStyles();

  if (leafletLoadPromise) {
    return leafletLoadPromise;
  }

  leafletLoadPromise = import('leaflet');

  return leafletLoadPromise;
}

/**
 * Load Maps JavaScript API with a browser-restricted key.
 * Returns null when no key is configured (callers should fall back to Leaflet).
 */
export function loadGoogleMaps(apiKey: string): Promise<any | null> {
  if (!apiKey || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }
  if ((window as any).google?.maps) {
    googleMapsLoadPromise = Promise.resolve((window as any).google.maps);
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const cbName = '__travlplanrGoogleMapsInit';
    (window as any)[cbName] = () => {
      resolve((window as any).google.maps);
      try {
        delete (window as any)[cbName];
      } catch {
        /* ignore */
      }
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps JavaScript API'));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function loadLeafletStyles(): void {
  if (typeof document === 'undefined' || document.querySelector('link[data-leaflet-styles]')) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/leaflet/leaflet.css';
  link.setAttribute('data-leaflet-styles', 'true');
  document.head.appendChild(link);
}
