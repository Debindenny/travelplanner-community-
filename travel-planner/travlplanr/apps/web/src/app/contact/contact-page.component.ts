import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { PublicPageShellComponent } from '../shared/components/public-page-shell/public-page-shell.component';
import { ContactService } from './contact.service';
import { ToastService } from '../shared/utils/toast.service';
import { SeoService } from '../shared/services/seo.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-contact-page',
    imports: [RouterLink, FormsModule, PublicPageShellComponent, TranslatePipe],
    template: `
    <app-public-page-shell variant="hero">
      <!-- Hero -->
      <section
        class="hero-gradient-dark relative flex min-h-[420px] w-full items-end justify-center overflow-hidden pb-16 pt-[73px]"
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div class="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full opacity-10" style="background:radial-gradient(circle,#ffffff 0%,transparent 70%)"></div>
          <div class="absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full opacity-10" style="background:radial-gradient(circle,#60a5fa 0%,transparent 70%)"></div>
        </div>
        <div class="section-container relative z-10 text-center">
          <span class="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/40 bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-blue-200 backdrop-blur-sm">
            {{ 'CONTACT.HERO.BADGE' | translate }}
          </span>
          <h1 class="mt-4 text-5xl font-bold leading-tight text-white md:text-6xl">{{ 'CONTACT.HERO.TITLE' | translate }}</h1>
          <p class="mx-auto mt-5 max-w-xl text-xl text-blue-100">
            {{ 'CONTACT.HERO.SUBTITLE' | translate }}
          </p>
        </div>
      </section>

      <!-- Form + Sidebar -->
      <section class="bg-white py-20">
        <div class="section-container">
          <div class="grid gap-16 lg:grid-cols-[1fr_420px]">

            <!-- Contact Form -->
            <div>
              <h2 #contactFormHeading tabindex="-1" class="text-3xl font-bold text-text-primary focus:outline-none">{{ 'CONTACT.FORM.HEADING' | translate }}</h2>
              <p class="mt-3 text-lg text-text-secondary">{{ 'CONTACT.FORM.SUBHEADING' | translate }}</p>

              @if (submitted()) {
                <div class="mt-10 flex items-start gap-4 rounded-2xl border border-green-200 bg-green-50 p-8">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                    </svg>
                  </div>
                  <div>
                    <p class="text-lg font-bold text-green-800">{{ 'CONTACT.FORM.SUCCESS.TITLE' | translate }}</p>
                    <p class="mt-1 text-green-700">{{ 'CONTACT.FORM.SUCCESS.MESSAGE' | translate:{ email: form.email } }}</p>
                    @if (ticketId()) {
                      <p class="mt-2 text-sm text-green-700">
                        {{ 'CONTACT.FORM.SUCCESS.TICKET_ID' | translate }}
                        <span class="font-mono font-semibold">{{ ticketId() }}</span>
                      </p>
                    }
                    <button
                      type="button"
                      class="mt-4 text-sm font-semibold text-green-700 underline hover:text-green-900"
                      (click)="resetForm()"
                    >{{ 'CONTACT.FORM.SUCCESS.SEND_ANOTHER' | translate }}</button>
                  </div>
                </div>
              } @else {
                <form class="mt-10 space-y-6" (ngSubmit)="onSubmit(contactForm)" #contactForm="ngForm" novalidate>

                  <!-- Name + Email -->
                  <div class="grid gap-6 sm:grid-cols-2">
                    <div>
                      <label for="contact-name" class="mb-2 block text-sm font-semibold text-text-primary">
                        {{ 'CONTACT.FORM.FIELDS.NAME_LABEL' | translate }} <span class="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        [(ngModel)]="form.name"
                        required
                        #nameField="ngModel"
                        [placeholder]="'CONTACT.FORM.FIELDS.NAME_PLACEHOLDER' | translate"
                        class="w-full rounded-xl border border-border bg-surface-muted px-4 py-3.5 text-text-primary placeholder-text-tertiary outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                        [class.border-red-400]="nameField.invalid && nameField.touched"
                        [attr.aria-invalid]="nameField.invalid && nameField.touched"
                        [attr.aria-describedby]="nameField.invalid && nameField.touched ? 'contact-name-error' : null"
                      />
                      @if (nameField.invalid && nameField.touched) {
                        <p id="contact-name-error" role="alert" class="mt-1.5 text-xs text-red-500">{{ 'CONTACT.FORM.FIELDS.NAME_ERROR' | translate }}</p>
                      }
                    </div>
                    <div>
                      <label for="contact-email" class="mb-2 block text-sm font-semibold text-text-primary">
                        {{ 'CONTACT.FORM.FIELDS.EMAIL_LABEL' | translate }} <span class="text-red-500">*</span>
                      </label>
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        [(ngModel)]="form.email"
                        required
                        email
                        #emailField="ngModel"
                        [placeholder]="'CONTACT.FORM.FIELDS.EMAIL_PLACEHOLDER' | translate"
                        class="w-full rounded-xl border border-border bg-surface-muted px-4 py-3.5 text-text-primary placeholder-text-tertiary outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                        [class.border-red-400]="emailField.invalid && emailField.touched"
                        [attr.aria-invalid]="emailField.invalid && emailField.touched"
                        [attr.aria-describedby]="emailField.invalid && emailField.touched ? 'contact-email-error' : null"
                      />
                      @if (emailField.invalid && emailField.touched) {
                        <p id="contact-email-error" role="alert" class="mt-1.5 text-xs text-red-500">{{ 'CONTACT.FORM.FIELDS.EMAIL_ERROR' | translate }}</p>
                      }
                    </div>
                  </div>

                  <!-- Subject -->
                  <div>
                    <label for="contact-subject" class="mb-2 block text-sm font-semibold text-text-primary">
                      {{ 'CONTACT.FORM.FIELDS.SUBJECT_LABEL' | translate }} <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                      <select
                        id="contact-subject"
                        name="subject"
                        [(ngModel)]="form.subject"
                        required
                        #subjectField="ngModel"
                        class="w-full appearance-none rounded-xl border border-border bg-surface-muted px-4 py-3.5 text-text-primary outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                        [class.border-red-400]="subjectField.invalid && subjectField.touched"
                        [class.text-text-tertiary]="!form.subject"
                        [attr.aria-invalid]="subjectField.invalid && subjectField.touched"
                        [attr.aria-describedby]="subjectField.invalid && subjectField.touched ? 'contact-subject-error' : null"
                      >
                        <option value="" disabled selected>{{ 'CONTACT.FORM.FIELDS.SUBJECT_PLACEHOLDER' | translate }}</option>
                        <option value="General Inquiry">{{ 'CONTACT.TOPICS.GENERAL_INQUIRY.NAME' | translate }}</option>
                        <option value="Technical Support">{{ 'CONTACT.TOPICS.TECHNICAL_SUPPORT.NAME' | translate }}</option>
                        <option value="Billing & Payments">{{ 'CONTACT.TOPICS.BILLING_PAYMENTS.NAME' | translate }}</option>
                        <option value="Partnership / B2B">{{ 'CONTACT.TOPICS.PARTNERSHIP_B2B.NAME' | translate }}</option>
                        <option value="Feature Request">{{ 'CONTACT.TOPICS.FEATURE_REQUEST.NAME' | translate }}</option>
                        <option value="Bug Report">{{ 'CONTACT.TOPICS.BUG_REPORT.NAME' | translate }}</option>
                        <option value="Press & Media">{{ 'CONTACT.TOPICS.PRESS_MEDIA.NAME' | translate }}</option>
                        <option value="Other">{{ 'CONTACT.TOPICS.OTHER.NAME' | translate }}</option>
                      </select>
                      <svg class="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                    @if (subjectField.invalid && subjectField.touched) {
                      <p id="contact-subject-error" role="alert" class="mt-1.5 text-xs text-red-500">{{ 'CONTACT.FORM.FIELDS.SUBJECT_ERROR' | translate }}</p>
                    }
                  </div>

                  <!-- Message -->
                  <div>
                    <label for="contact-message" class="mb-2 block text-sm font-semibold text-text-primary">
                      {{ 'CONTACT.FORM.FIELDS.MESSAGE_LABEL' | translate }} <span class="text-red-500">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      [(ngModel)]="form.message"
                      required
                      minlength="20"
                      maxlength="2000"
                      #messageField="ngModel"
                      rows="6"
                      [placeholder]="'CONTACT.FORM.FIELDS.MESSAGE_PLACEHOLDER' | translate"
                      class="w-full resize-none rounded-xl border border-border bg-surface-muted px-4 py-3.5 text-text-primary placeholder-text-tertiary outline-none transition-all focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                      [class.border-red-400]="messageField.invalid && messageField.touched"
                      [attr.aria-invalid]="messageField.invalid && messageField.touched"
                      [attr.aria-describedby]="messageField.invalid && messageField.touched ? 'contact-message-error contact-message-count' : 'contact-message-count'"
                    ></textarea>
                    <div class="mt-1.5 flex items-center justify-between">
                      @if (messageField.invalid && messageField.touched) {
                        <p id="contact-message-error" role="alert" class="text-xs text-red-500">{{ 'CONTACT.FORM.FIELDS.MESSAGE_ERROR' | translate }}</p>
                      } @else {
                        <span></span>
                      }
                      <span id="contact-message-count" class="text-xs" [class.text-red-400]="form.message.length > 1900" [class.text-text-tertiary]="form.message.length <= 1900">
                        {{ form.message.length }} / 2000
                      </span>
                    </div>
                  </div>

                  <!-- Submit -->
                  <div class="flex flex-wrap items-center gap-5 pt-2">
                    <button
                      type="submit"
                      [disabled]="submitting()"
                      class="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-primary px-10 text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      @if (submitting()) {
                        <svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        {{ 'CONTACT.FORM.SUBMIT.SENDING' | translate }}
                      } @else {
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12zm0 0h7.5"/>
                        </svg>
                        {{ 'CONTACT.FORM.SUBMIT.SEND_MESSAGE' | translate }}
                      }
                    </button>
                    <p class="text-sm text-text-tertiary">
                      <svg class="mr-1 inline h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>
                      {{ 'CONTACT.FORM.SUBMIT.RESPONSE_NOTE' | translate }}
                    </p>
                    @if (contactForm.submitted && contactForm.invalid) {
                      <p role="alert" class="basis-full text-sm font-medium text-red-600">
                        {{ 'CONTACT.FORM.SUBMIT.VALIDATION_ERROR' | translate }}
                      </p>
                    }
                  </div>
                </form>
              }
            </div>

            <!-- Sidebar -->
            <div class="space-y-6">

              <!-- Contact info -->
              <div class="rounded-2xl border border-border-light bg-surface-muted p-7">
                <h3 class="text-lg font-bold text-text-primary">{{ 'CONTACT.SIDEBAR.INFO.HEADING' | translate }}</h3>
                <div class="mt-6 space-y-5">

                  <div class="flex items-start gap-4">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-primary">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-text-primary">{{ 'CONTACT.SIDEBAR.INFO.EMAIL_LABEL' | translate }}</p>
                      <a href="mailto:support@travlplanr.com" class="mt-0.5 block text-sm text-primary no-underline hover:underline">support&#64;travlplanr.com</a>
                      <a href="mailto:partnerships@travlplanr.com" class="mt-0.5 block text-sm text-primary no-underline hover:underline">partnerships&#64;travlplanr.com</a>
                    </div>
                  </div>

                  <div class="flex items-start gap-4">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-text-primary">{{ 'CONTACT.SIDEBAR.INFO.CHAT_LABEL' | translate }}</p>
                      <p class="mt-0.5 text-sm text-text-secondary">{{ 'CONTACT.SIDEBAR.INFO.CHAT_AVAILABLE' | translate }}</p>
                      <p class="text-xs text-text-tertiary">{{ 'CONTACT.SIDEBAR.INFO.CHAT_NOTE' | translate }}</p>
                    </div>
                  </div>

                  <div class="flex items-start gap-4">
                    <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-semibold text-text-primary">{{ 'CONTACT.SIDEBAR.INFO.OFFICE_LABEL' | translate }}</p>
                      <p class="mt-0.5 text-sm text-text-secondary">{{ 'CONTACT.SIDEBAR.INFO.OFFICE_LOCATION' | translate }}</p>
                      <p class="text-xs text-text-tertiary">560001</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Response times -->
              <div class="rounded-2xl bg-primary p-7 text-white">
                <div class="flex items-center gap-3">
                  <svg class="h-7 w-7 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                  </svg>
                  <h3 class="text-lg font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.HEADING' | translate }}</h3>
                </div>
                <div class="mt-5 divide-y divide-white/20">
                  <div class="flex items-center justify-between py-3">
                    <span class="text-sm text-white/80">{{ 'CONTACT.TOPICS.GENERAL_INQUIRY.NAME' | translate }}</span>
                    <span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.GENERAL_TIME' | translate }}</span>
                  </div>
                  <div class="flex items-center justify-between py-3">
                    <span class="text-sm text-white/80">{{ 'CONTACT.TOPICS.TECHNICAL_SUPPORT.NAME' | translate }}</span>
                    <span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.TECHNICAL_TIME' | translate }}</span>
                  </div>
                  <div class="flex items-center justify-between py-3">
                    <span class="text-sm text-white/80">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.BILLING_LABEL' | translate }}</span>
                    <span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.BILLING_TIME' | translate }}</span>
                  </div>
                  <div class="flex items-center justify-between py-3">
                    <span class="text-sm text-white/80">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.PARTNERSHIP_LABEL' | translate }}</span>
                    <span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.PARTNERSHIP_TIME' | translate }}</span>
                  </div>
                  <div class="flex items-center justify-between py-3">
                    <span class="text-sm text-white/80">{{ 'CONTACT.TOPICS.PRESS_MEDIA.NAME' | translate }}</span>
                    <span class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold">{{ 'CONTACT.SIDEBAR.RESPONSE_TIMES.PRESS_TIME' | translate }}</span>
                  </div>
                </div>
              </div>

              <!-- FAQ shortcut -->
              <div class="flex items-center gap-4 rounded-2xl border border-border bg-surface-muted p-6">
                <svg class="h-8 w-8 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 5.25h.008v.008H12v-.008z"/>
                </svg>
                <div>
                  <p class="font-bold text-text-primary">{{ 'CONTACT.SIDEBAR.FAQ.HEADING' | translate }}</p>
                  <p class="mt-0.5 text-sm text-text-secondary">{{ 'CONTACT.SIDEBAR.FAQ.SUBHEADING' | translate }}</p>
                  <a routerLink="/faq" class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary no-underline hover:underline">
                    {{ 'CONTACT.SIDEBAR.FAQ.LINK' | translate }}
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Topic cards -->
      <section class="bg-surface-muted py-20">
        <div class="section-container">
          <div class="mb-12 text-center">
            <p class="mb-3 text-sm font-bold uppercase tracking-widest text-primary">{{ 'CONTACT.TOPIC_CARDS.EYEBROW' | translate }}</p>
            <h2 class="text-3xl font-bold text-text-primary md:text-4xl">{{ 'CONTACT.TOPIC_CARDS.HEADING' | translate }}</h2>
            <p class="mx-auto mt-3 max-w-xl text-lg text-text-secondary">{{ 'CONTACT.TOPIC_CARDS.SUBHEADING' | translate }}</p>
          </div>
          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            @for (topic of topics; track topic.title) {
              <button
                type="button"
                class="group rounded-2xl border border-border bg-white p-7 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                (click)="selectTopic(topic.subject)"
              >
                <div class="flex h-12 w-12 items-center justify-center rounded-xl" [style.background]="topic.iconBg">
                  <svg class="h-6 w-6" [style.color]="topic.iconColor" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="topic.iconPath"/>
                  </svg>
                </div>
                <h3 class="mt-4 text-lg font-bold text-text-primary transition-colors group-hover:text-primary">{{ topic.title | translate }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-text-secondary">{{ topic.description | translate }}</p>
                <div class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  {{ 'CONTACT.TOPIC_CARDS.SELECT_CTA' | translate }}
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </div>
              </button>
            }
          </div>
        </div>
      </section>

    </app-public-page-shell>
  `,
    styles: []
})
export class ContactPageComponent implements OnInit {
  @ViewChild('contactFormHeading') private contactFormHeading?: ElementRef<HTMLElement>;

  form = { name: '', email: '', subject: '', message: '' };

  submitting = signal(false);
  submitted = signal(false);
  ticketId = signal<string | null>(null);

  readonly topics = [
    {
      title: 'CONTACT.TOPICS.GENERAL_INQUIRY.NAME',
      subject: 'General Inquiry',
      description: 'CONTACT.TOPICS.GENERAL_INQUIRY.DESCRIPTION',
      iconBg: '#EEF2FF',
      iconColor: '#6366F1',
      iconPath: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 5.25h.008v.008H12v-.008z',
    },
    {
      title: 'CONTACT.TOPICS.TECHNICAL_SUPPORT.NAME',
      subject: 'Technical Support',
      description: 'CONTACT.TOPICS.TECHNICAL_SUPPORT.DESCRIPTION',
      iconBg: '#FFF7ED',
      iconColor: '#EA580C',
      iconPath: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
    },
    {
      title: 'CONTACT.TOPICS.BILLING_PAYMENTS.NAME',
      subject: 'Billing & Payments',
      description: 'CONTACT.TOPICS.BILLING_PAYMENTS.DESCRIPTION',
      iconBg: '#F0FDF4',
      iconColor: '#16A34A',
      iconPath: 'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
    },
    {
      title: 'CONTACT.TOPICS.PARTNERSHIP_B2B.NAME',
      subject: 'Partnership / B2B',
      description: 'CONTACT.TOPICS.PARTNERSHIP_B2B.DESCRIPTION',
      iconBg: '#EFF6FF',
      iconColor: '#2563EB',
      iconPath: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0z',
    },
    {
      title: 'CONTACT.TOPICS.FEATURE_REQUEST.NAME',
      subject: 'Feature Request',
      description: 'CONTACT.TOPICS.FEATURE_REQUEST.DESCRIPTION',
      iconBg: '#FDF4FF',
      iconColor: '#9333EA',
      iconPath: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456z',
    },
    {
      title: 'CONTACT.TOPICS.PRESS_MEDIA.NAME',
      subject: 'Press & Media',
      description: 'CONTACT.TOPICS.PRESS_MEDIA.DESCRIPTION',
      iconBg: '#FFF1F2',
      iconColor: '#E11D48',
      iconPath: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3z',
    },
  ];

  private readonly contactService = inject(ContactService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  ngOnInit(): void {
    this.seo.set({
      title: this.translate.instant('CONTACT.SEO.TITLE'),
      description: this.translate.instant('CONTACT.SEO.DESCRIPTION'),
    });

    const subject = this.route.snapshot.queryParamMap.get('subject');
    if (subject && this.topics.some((topic) => topic.subject === subject)) {
      this.form.subject = subject;
      setTimeout(() => this.focusForm());
    }
  }

  selectTopic(subject: string): void {
    this.form.subject = subject;
    this.focusForm();
  }

  async onSubmit(contactForm: NgForm): Promise<void> {
    contactForm.form.markAllAsTouched();
    if (contactForm.invalid) {
      this.focusForm();
      return;
    }

    this.submitting.set(true);
    try {
      const res = await this.contactService.submit(this.form);
      this.ticketId.set(res.id);
      this.submitted.set(true);
    } catch (err) {
      console.error('Contact form submission failed', err);
      this.toast.error(this.translate.instant('CONTACT.FORM.SUBMIT.TOAST_ERROR'));
    } finally {
      this.submitting.set(false);
    }
  }

  resetForm(): void {
    this.form = { name: '', email: '', subject: '', message: '' };
    this.submitted.set(false);
    this.ticketId.set(null);
  }

  private focusForm(): void {
    this.contactFormHeading?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.contactFormHeading?.nativeElement.focus({ preventScroll: true });
  }
}
