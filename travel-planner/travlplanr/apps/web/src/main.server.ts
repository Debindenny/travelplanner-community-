import { provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

// Prerendering runs the app in Node, where the Web Storage API doesn't
// exist. Several services (auth session, wizard draft, chat history) touch
// localStorage/sessionStorage during bootstrap; an in-memory stand-in lets
// them run unmodified and simply start empty, exactly like a fresh visitor.
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  } as Storage;
}

const globals = globalThis as Record<string, unknown>;
if (typeof globals['localStorage'] === 'undefined') globals['localStorage'] = memoryStorage();
if (typeof globals['sessionStorage'] === 'undefined') globals['sessionStorage'] = memoryStorage();

const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, {...config, providers: [provideZoneChangeDetection(), ...config.providers]}, context);

export default bootstrap;
