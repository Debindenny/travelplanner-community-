import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiUrl } from '../shared/utils/api-url';

export interface ContactFormPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactFormResponse {
  id: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  async submit(payload: ContactFormPayload): Promise<ContactFormResponse> {
    return firstValueFrom(this.http.post<ContactFormResponse>(apiUrl('/contact'), payload));
  }
}
