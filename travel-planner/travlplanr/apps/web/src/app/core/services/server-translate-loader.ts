import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import en from '../../../assets/i18n/en.json';
import es from '../../../assets/i18n/es.json';
import fr from '../../../assets/i18n/fr.json';

// The HTTP loader used in the browser fetches a relative /assets/i18n/*.json
// URL, which Node's fetch can't resolve during prerendering (no origin) —
// translations silently fail to load and every `| translate` renders its raw
// key into the prerendered HTML. Bundling the JSON directly sidesteps the
// network entirely for the server render.
const TRANSLATIONS: Record<string, any> = { en, es, fr };

export class ServerTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of((TRANSLATIONS[lang] ?? TRANSLATIONS['en']) as TranslationObject);
  }
}
