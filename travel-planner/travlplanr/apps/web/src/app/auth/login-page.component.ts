import { Component, DestroyRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrimaryButtonComponent } from 'ui';
import { OtpInputComponent } from './otp-input.component';
import { AuthService } from './auth.service';
import { ChatContextService } from '../shared/services/chat-context.service';
import { ToastService } from '../shared/utils/toast.service';
import { apiErrorMessage } from '../shared/utils/api-error.util';
import { environment } from '../../environments/environment';
import { PublicConfigService } from '../shared/services/public-config.service';

declare global {
  interface Window {
    google?: any;
    __travlplanrGoogleIdentityPromise?: Promise<void>;
  }
}

const GOOGLE_IDENTITY_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (window.__travlplanrGoogleIdentityPromise) {
    return window.__travlplanrGoogleIdentityPromise;
  }

  window.__travlplanrGoogleIdentityPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return window.__travlplanrGoogleIdentityPromise;
}

interface LoginContext {
  titleKey: string;
  bodyKey: string;
}

function resolveLoginContext(returnUrl: string | null): LoginContext | null {
  if (!returnUrl) return null;
  if (returnUrl.startsWith('/trips')) return { titleKey: 'AUTH.CONTEXT_TRIPS_TITLE', bodyKey: 'AUTH.CONTEXT_TRIPS_BODY' };
  if (returnUrl.startsWith('/profile')) return { titleKey: 'AUTH.CONTEXT_PROFILE_TITLE', bodyKey: 'AUTH.CONTEXT_PROFILE_BODY' };
  if (returnUrl.startsWith('/wizard')) return { titleKey: 'AUTH.CONTEXT_WIZARD_TITLE', bodyKey: 'AUTH.CONTEXT_WIZARD_BODY' };
  if (returnUrl.startsWith('/packages')) return { titleKey: 'AUTH.CONTEXT_PACKAGES_TITLE', bodyKey: 'AUTH.CONTEXT_PACKAGES_BODY' };
  if (returnUrl.startsWith('/itinerary')) return { titleKey: 'AUTH.CONTEXT_ITINERARY_TITLE', bodyKey: 'AUTH.CONTEXT_ITINERARY_BODY' };
  if (returnUrl.startsWith('/community/messages')) return { titleKey: 'AUTH.CONTEXT_MESSAGES_TITLE', bodyKey: 'AUTH.CONTEXT_MESSAGES_BODY' };
  return { titleKey: 'AUTH.CONTEXT_DEFAULT_TITLE', bodyKey: 'AUTH.CONTEXT_DEFAULT_BODY' };
}

@Component({
    selector: 'app-login-page',
    imports: [ReactiveFormsModule, RouterLink, PrimaryButtonComponent, OtpInputComponent, TranslatePipe],
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.scss'
})
export class LoginPageComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly chatContext = inject(ChatContextService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly publicConfig = inject(PublicConfigService);

  /** Prevents query-param subscription from fighting programmatic step updates. */
  private syncingStepFromUrl = false;
  private googleIdentityInitialized = false;

  @ViewChild('otpInput') otpInputRef?: OtpInputComponent;

  readonly step = signal<'email' | 'otp'>('email');
  readonly error = signal('');
  readonly isLoading = signal(false);
  readonly devOtp = signal<string | null>(null);
  readonly submitAttempted = signal(false);
  readonly isProduction = environment.production;
  readonly googleClientId = signal('');

  readonly otpExpiresIn = signal(0);
  readonly otpTimerActive = signal(false);
  readonly resendCooldown = signal(0);
  private _timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly returnUrl = signal<string | null>(null);
  readonly loginContext = signal<LoginContext | null>(null);

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const returnUrl = params['returnUrl'] ?? null;
      this.returnUrl.set(returnUrl);
      this.loginContext.set(resolveLoginContext(returnUrl));

      if (this.syncingStepFromUrl) return;

      if (params['step'] === 'otp') {
        this.applyOtpStepFromUrl();
      } else {
        this.applyEmailStepFromUrl();
      }
    });

    // If a pending OTP exists but the URL has no step yet, sync the URL so back/forward works.
    const pendingEmail = this.auth.getPendingOtpEmail();
    const sentAt = this.auth.getOtpSentAt();
    if (pendingEmail && sentAt && this.route.snapshot.queryParamMap.get('step') !== 'otp') {
      const elapsedSeconds = (Date.now() - new Date(sentAt).getTime()) / 1000;
      if (elapsedSeconds < 300) {
        void this.setUrlStep('otp');
      } else {
        this.auth.clearPendingOtp();
      }
    }

    void this.initializeGoogleAuth();
  }

  ngOnDestroy(): void {
    this._clearTimer();
  }

  private _startOtpTimer(expiresInSeconds: number, cooldownSeconds = 60): void {
    this._clearTimer();
    this.otpTimerActive.set(true);
    this.otpExpiresIn.set(Math.max(0, Math.round(expiresInSeconds)));
    this.resendCooldown.set(Math.max(0, Math.round(cooldownSeconds)));

    this._timerInterval = setInterval(() => {
      const exp = this.otpExpiresIn();
      if (exp > 0) this.otpExpiresIn.set(exp - 1);
      const cd = this.resendCooldown();
      if (cd > 0) this.resendCooldown.set(cd - 1);
      // Stop ticking once both are zero
      if (this.otpExpiresIn() === 0 && this.resendCooldown() === 0) {
        this._clearTimer();
      }
    }, 1000);
  }

  private _clearTimer(): void {
    if (this._timerInterval !== null) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  formatSeconds(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  async sendOtp(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.emailForm.invalid || this.isLoading()) return;
    this.error.set('');
    this.isLoading.set(true);
    try {
      const { devOtp } = await this.auth.sendOtp(this.emailForm.value.email!);
      this.devOtp.set(!this.isProduction && devOtp ? devOtp : null);
      this.otpForm.reset();
      this.step.set('otp');
      this.submitAttempted.set(false);
      this._startOtpTimer(300, 60);
      void this.setUrlStep('otp');
      setTimeout(() => this.otpInputRef?.focusFirst());
    } catch (e: any) {
      this.error.set(this._extractError(e, 'AUTH.ERRORS.SEND_FAILED'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendOtp(): Promise<void> {
    if (this.resendCooldown() > 0 || this.isLoading()) return;
    this.error.set('');
    this.isLoading.set(true);
    try {
      const { devOtp } = await this.auth.sendOtp(this.emailForm.value.email!);
      this.devOtp.set(!this.isProduction && devOtp ? devOtp : null);
      this.otpForm.reset();
      this._startOtpTimer(300, 60);
      setTimeout(() => this.otpInputRef?.focusFirst());
    } catch (e: any) {
      this.error.set(this._extractError(e, 'AUTH.ERRORS.SEND_FAILED'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async verifyOtp(): Promise<void> {
    this.submitAttempted.set(true);
    if (this.otpForm.invalid || this.isLoading()) return;
    this.error.set('');
    this.isLoading.set(true);
    try {
      const ok = await this.auth.verifyOtp(this.emailForm.value.email!, this.otpForm.value.otp!);
      if (ok) {
        await this.finishLogin();
      } else {
        this.error.set(this.translate.instant('AUTH.ERRORS.INVALID_CODE'));
      }
    } catch (e: any) {
      this.error.set(this._extractError(e, 'AUTH.ERRORS.VERIFY_FAILED'));
    } finally {
      this.isLoading.set(false);
    }
  }

  goBackToEmail(): void {
    void this.setUrlStep(null);
  }

  async continueWithGoogle(): Promise<void> {
    if (this.isLoading()) return;
    this.error.set('');
    if (!this.googleClientId()) return;

    try {
      if (!this.googleIdentityInitialized) {
        await this.initializeGoogleAuth();
      }
      if (!this.googleIdentityInitialized || !window.google?.accounts?.id) {
        this.error.set(this.translate.instant('AUTH.ERRORS.GOOGLE_UNAVAILABLE'));
        return;
      }
      window.google.accounts.id.prompt();
    } catch {
      this.error.set(this.translate.instant('AUTH.ERRORS.GOOGLE_UNAVAILABLE'));
    }
  }

  private applyOtpStepFromUrl(): void {
    const pendingEmail = this.auth.getPendingOtpEmail();
    const sentAt = this.auth.getOtpSentAt();
    if (!pendingEmail || !sentAt) {
      void this.setUrlStep(null);
      return;
    }
    const elapsedSeconds = (Date.now() - new Date(sentAt).getTime()) / 1000;
    if (elapsedSeconds >= 300) {
      this.auth.clearPendingOtp();
      void this.setUrlStep(null);
      return;
    }
    this.emailForm.controls.email.setValue(pendingEmail);
    this.step.set('otp');
    const remaining = 300 - elapsedSeconds;
    const cooldown = Math.max(0, 60 - elapsedSeconds);
    this._startOtpTimer(remaining, cooldown);
  }

  private applyEmailStepFromUrl(): void {
    this.step.set('email');
    this.devOtp.set(null);
    this.error.set('');
    this.submitAttempted.set(false);
    this._clearTimer();
    this.otpTimerActive.set(false);
    this.otpForm.reset();
  }

  private async setUrlStep(step: 'otp' | null): Promise<void> {
    this.syncingStepFromUrl = true;
    try {
      await this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { step: step ?? null },
        queryParamsHandling: 'merge',
      });
    } finally {
      this.syncingStepFromUrl = false;
    }
  }

  private _extractError(e: any, fallbackKey: string): string {
    if (e?.status === 429) return this.translate.instant('AUTH.ERRORS.TOO_MANY_ATTEMPTS');
    return apiErrorMessage(e, this.translate.instant(fallbackKey));
  }

  private async initializeGoogleAuth(): Promise<void> {
    const clientId = (await this.publicConfig.getGoogleOAuthClientId()).trim();
    this.googleClientId.set(clientId);
    if (!clientId) return;

    try {
      await loadGoogleIdentityScript();
      if (!window.google?.accounts?.id) {
        throw new Error('Google Identity Services unavailable');
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          void this.handleGoogleCredential(response?.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this.googleIdentityInitialized = true;
    } catch (error) {
      console.warn('Google sign-in unavailable', error);
      this.googleIdentityInitialized = false;
      this.googleClientId.set('');
    }
  }

  private async handleGoogleCredential(idToken?: string): Promise<void> {
    if (!idToken || this.isLoading()) return;
    this.error.set('');
    this.isLoading.set(true);
    try {
      const ok = await this.auth.signInWithGoogle(idToken, this.emailForm.value.email || undefined);
      if (ok) {
        await this.finishLogin();
      } else {
        this.error.set(this.translate.instant('AUTH.ERRORS.GOOGLE_FAILED'));
      }
    } catch (e: any) {
      this.error.set(this._extractError(e, 'AUTH.ERRORS.GOOGLE_FAILED'));
    } finally {
      this.isLoading.set(false);
    }
  }

  private async finishLogin(): Promise<void> {
    this._clearTimer();
    this.toast.success(this.translate.instant('AUTH.SUCCESS'));
    const resumed = await this.chatContext.resumePendingChatTripIfAny();
    if (!resumed) {
      await this.router.navigateByUrl(this.returnUrl() || '/trips');
    }
  }
}
