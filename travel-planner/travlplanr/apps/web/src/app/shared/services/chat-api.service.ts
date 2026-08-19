import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatApiResponse, ChatTripSlots } from '../utils/chat-intent.util';
import { AuthService } from '../../auth/auth.service';
import type { paths } from '../../api/generated/planner';

// Typed path constants derived from the generated OpenAPI schema — TypeScript
// catches any rename/removal of these endpoints at compile time, eliminating
// silent contract drift between the frontend and the API spec.
const CHAT_PATH = '/api/v1/chat' satisfies keyof paths;
const CHAT_STREAM_PATH = '/api/v1/chat/stream' satisfies keyof paths;
const VOICE_PATH = '/api/v1/voice/message' satisfies keyof paths;

/**
 * Builds an absolute URL from a generated OpenAPI path (which already includes
 * the full `/api/v1/...` prefix).  Uses the same `environment.apiBase` as
 * `apiUrl()` but skips the prefix addition — generated paths are already
 * fully qualified.
 */
function plannerUrl(path: typeof CHAT_PATH | typeof CHAT_STREAM_PATH | typeof VOICE_PATH): string {
  const base = environment.apiBase || '';
  return `${base}${path}`;
}

export interface ChatStreamHandlers {
  /** Called with each incremental text chunk as the model generates. */
  onToken: (chunk: string) => void;
  /** Called when post-processing rewrote the reply wholesale. */
  onReplace: (fullText: string) => void;
  signal?: AbortSignal;
}

export interface ChatRequestPayload {
  message: string;
  history: Array<{ role: string; content: string }>;
  context?: {
    path?: string | null;
    trip_id?: string | null;
    region?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
    collecting_duration?: boolean;
    locale?: string;
    known_slots?: ChatTripSlots | Record<string, unknown>;
    last_action_outcome?: string | null;
  };
}

export interface ChatSessionSummary {
  id: string;
  title?: string | null;
  trip_id?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatSessionMessage {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /**
   * Streaming send via fetch (HttpClient can't consume ndjson incrementally).
   * Resolves with the final metadata (actions, slots, images) once the
   * stream completes; throws before any token if the endpoint is
   * unavailable so callers can fall back to the blocking send().
   */
  async sendStream(payload: ChatRequestPayload, handlers: ChatStreamHandlers): Promise<ChatApiResponse | null> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.auth.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(plannerUrl(CHAT_STREAM_PATH), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: handlers.signal,
    });
    if (!res.ok || !res.body) {
      throw new HttpErrorResponse({ status: res.status, url: plannerUrl(CHAT_STREAM_PATH) });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let meta: ChatApiResponse | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event: { type?: string; text?: string; data?: ChatApiResponse };
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === 'token' && event.text) handlers.onToken(event.text);
        else if (event.type === 'replace' && typeof event.text === 'string') handlers.onReplace(event.text);
        else if (event.type === 'meta' && event.data) meta = event.data;
      }
    }
    return meta;
  }

  async send(payload: ChatRequestPayload): Promise<ChatApiResponse> {
    let lastError: unknown;
    const delays = [0, 700, 1500];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
      try {
        return await this.postOnce(payload);
      } catch (err) {
        lastError = err;
        if (!this.isRetryable(err) || attempt === delays.length - 1) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Cannot reach the travel assistant right now. Make sure the backend is running, then refresh this page and try again.';
      }
      if (err.status === 401 || err.status === 403) {
        return 'Your session expired. Please log in again to personalize trip actions.';
      }
      if (err.status === 429) {
        return 'Too many messages in a short time. Please wait a moment and try again.';
      }
      if (err.status === 502 || err.status === 503 || err.status === 504) {
        return 'The travel assistant is waking up. Please try again in a few seconds.';
      }
      if (err.status >= 500) {
        return 'The travel assistant is temporarily unavailable. Please try again in a few seconds.';
      }
    }
    return 'Sorry, I am having trouble connecting right now. Please try again.';
  }

  private async postOnce(payload: ChatRequestPayload): Promise<ChatApiResponse> {
    return firstValueFrom(
      this.http.post<ChatApiResponse>(plannerUrl(CHAT_PATH), payload).pipe(
        timeout(45000),
        catchError((err) => throwError(() => err)),
      ),
    );
  }

  async sendVoice(
    audioBlob: Blob,
    context?: {
      trip_id?: string | null;
      region?: string | null;
      path?: string | null;
      session_id?: string | null;
      collecting_duration?: boolean;
      locale?: string;
      known_slots?: ChatTripSlots | Record<string, unknown>;
      history?: Array<{ role: string; content: string }>;
    },
  ): Promise<ChatApiResponse & { audio_url?: string; transcript?: string; session_id?: string }> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (context?.trip_id) formData.append('trip_id', context.trip_id);
    if (context?.region) formData.append('region', context.region);
    if (context?.path) formData.append('path', context.path);
    if (context?.session_id) formData.append('session_id', context.session_id);
    if (context?.collecting_duration) formData.append('collecting_duration', 'true');
    if (context?.locale) formData.append('locale', context.locale);
    if (context?.known_slots) formData.append('known_slots', JSON.stringify(context.known_slots));
    if (context?.history?.length) formData.append('history', JSON.stringify(context.history));

    return firstValueFrom(
      this.http.post<ChatApiResponse & { audio_url?: string; transcript?: string; session_id?: string }>(plannerUrl(VOICE_PATH), formData).pipe(
        timeout(60000),
        catchError((err) => throwError(() => err)),
      ),
    );
  }

  private isRetryable(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse)) return false;
    return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
  }

  /** Server-side chat session memory (logged-in users). Failures are soft. */
  async createSession(opts?: { title?: string; trip_id?: string | null }): Promise<ChatSessionSummary | null> {
    try {
      return await firstValueFrom(
        this.http
          .post<ChatSessionSummary>(`${environment.apiBase || ''}/api/v1/chat/sessions`, {
            title: opts?.title ?? null,
            trip_id: opts?.trip_id ?? null,
          })
          .pipe(timeout(8000), catchError(() => throwError(() => null))),
      );
    } catch {
      return null;
    }
  }

  async listSessions(limit = 10): Promise<ChatSessionSummary[]> {
    try {
      return await firstValueFrom(
        this.http
          .get<ChatSessionSummary[]>(`${environment.apiBase || ''}/api/v1/chat/sessions`, {
            params: { limit: String(limit) },
          })
          .pipe(timeout(8000), catchError(() => throwError(() => []))),
      );
    } catch {
      return [];
    }
  }

  async getSessionMessages(sessionId: string, limit = 50): Promise<ChatSessionMessage[]> {
    try {
      return await firstValueFrom(
        this.http
          .get<ChatSessionMessage[]>(
            `${environment.apiBase || ''}/api/v1/chat/sessions/${sessionId}/messages`,
            { params: { limit: String(limit) } },
          )
          .pipe(timeout(8000), catchError(() => throwError(() => []))),
      );
    } catch {
      return [];
    }
  }

  async appendSessionMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    interactionId?: string | null,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http
          .post(`${environment.apiBase || ''}/api/v1/chat/sessions/${sessionId}/messages`, {
            role,
            content,
            interaction_id: interactionId ?? null,
          })
          .pipe(timeout(8000), catchError(() => throwError(() => undefined))),
      );
    } catch {
      /* offline / guest — localStorage remains source of truth */
    }
  }
}
