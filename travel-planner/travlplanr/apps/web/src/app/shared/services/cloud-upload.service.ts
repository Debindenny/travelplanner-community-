import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { apiUrl } from '../utils/api-url';

export interface UploadResponse {
  url: string;
  thumbnailUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class CloudUploadService {
  private readonly http = inject(HttpClient);

  /**
   * Uploads a file through the backend, which validates type/size/magic bytes and
   * stores it in object storage, and returns the persisted public URL.
   *
   * This previously requested a pre-signed URL from `/storage/presigned-url` — an
   * endpoint that does not exist in the backend — and on failure fell back to
   * `URL.createObjectURL(file)`. That returns a `blob:` URL scoped to the current
   * document: callers would persist it as if it were a real image URL, producing
   * records that are permanently broken for every other viewer and after reload.
   * Failures now surface to the caller instead of being silently papered over.
   */
  uploadFile(file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file, file.name);

    return this.http.post<UploadResponse>(apiUrl('/community/upload'), form).pipe(
      map((res) => {
        if (!res?.url) {
          throw new Error('Upload succeeded but returned no URL');
        }
        return res.url;
      }),
      catchError((err) => throwError(() => err))
    );
  }
}
