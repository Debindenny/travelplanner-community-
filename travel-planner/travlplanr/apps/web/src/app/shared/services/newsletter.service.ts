import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../utils/api-url';

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly http = inject(HttpClient);

  async subscribe(email: string, consent: boolean): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl('/newsletter'), { email, consent }));
  }
}
