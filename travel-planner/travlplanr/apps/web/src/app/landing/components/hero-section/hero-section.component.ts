import { Component, ElementRef, HostListener, OnDestroy, AfterViewInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimatedLinkComponent } from '../../../shared/components/animated-link/animated-link.component';
import { DestinationTypeaheadComponent } from '../../../shared/components/destination-typeahead/destination-typeahead.component';
import { SearchPlanAssistComponent } from '../../../shared/components/search-plan-assist/search-plan-assist.component';
import { TripSlotsRowComponent } from '../../../shared/components/trip-slots-row/trip-slots-row.component';
import { TravelChatMessagesComponent } from '../../../shared/components/travel-chat-messages/travel-chat-messages.component';
import { TravelChatSessionService } from '../../../shared/services/travel-chat-session.service';
import { ChatContextService } from '../../../shared/services/chat-context.service';
import { DestinationSearchService } from '../../../shared/services/destination-search.service';
import { DestinationListItem } from '../../../shared/utils/destination.util';
import { TranslatePipe } from '@ngx-translate/core';

// PROTECTED SURFACE: see ./PROTECTED.md before changing video/mute/composer/typeahead markup below.
@Component({
    selector: 'app-hero-section',
    imports: [AnimatedLinkComponent, RouterLink, TravelChatMessagesComponent, DestinationTypeaheadComponent, SearchPlanAssistComponent, TripSlotsRowComponent, TranslatePipe],
    styles: [
        `
      :host {
        display: block;
        width: 100%;
        margin: 0;
        padding: 0;
        --hero-nav-offset: 4.75rem;
        --hero-section-nav-offset: 2.85rem;
        --hero-bottom-safe: max(0.75rem, env(safe-area-inset-bottom, 0px));
        --hero-chat-max: calc(100dvh - var(--hero-nav-offset) - 6.5rem);
        --hero-dock-min: 560px;
        --hero-dock-max: 920px;
        --hero-dock-chat-width: min(75vw, calc(100vw - 3rem));
        --hero-dock-grow: calc(var(--hero-dock-max) - var(--hero-dock-min));
      }

      .hero-viewport {
        position: relative;
        width: 100%;
        overflow: hidden;
        height: 100vh;
        height: 100dvh;
        max-height: 100dvh;
      }

      .hero-overlay {
        min-height: 0;
        transition: padding 0.55s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-overlay.composer-front {
        z-index: 45;
      }
      .hero-overlay.chat-active {
        justify-content: flex-end !important;
        align-items: center;
        padding-top: var(--hero-nav-offset);
        padding-bottom: var(--hero-bottom-safe);
        overflow: hidden;
      }

      @keyframes scrollBounce {
        0%, 100% { transform: translateY(0); opacity: 0.7; }
        50%       { transform: translateY(8px); opacity: 1; }
      }
      .scroll-indicator {
        animation: scrollBounce 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        transition: opacity 0.6s ease;
      }
      .scroll-indicator.hidden-cue {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }

      .composer-scrim {
        position: fixed;
        inset: 0;
        z-index: 35;
        background: linear-gradient(
          180deg,
          rgba(15, 23, 42, 0) 0%,
          rgba(15, 23, 42, 0) 14%,
          rgba(15, 23, 42, 0.1) 24%,
          rgba(15, 23, 42, 0.22) 52%,
          rgba(15, 23, 42, 0.34) 100%
        );
        backdrop-filter: blur(10px) saturate(1.05);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        -webkit-mask-image: linear-gradient(
          180deg,
          transparent 0px,
          transparent calc(var(--hero-nav-offset) + var(--hero-section-nav-offset)),
          #000 calc(var(--hero-nav-offset) + var(--hero-section-nav-offset) + 1.25rem),
          #000 100%
        );
        mask-image: linear-gradient(
          180deg,
          transparent 0px,
          transparent calc(var(--hero-nav-offset) + var(--hero-section-nav-offset)),
          #000 calc(var(--hero-nav-offset) + var(--hero-section-nav-offset) + 1.25rem),
          #000 100%
        );
        opacity: 0;
        pointer-events: none;
        transition:
          opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          background 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .composer-scrim.visible {
        opacity: 1;
        pointer-events: auto;
      }
      .composer-scrim.chat-visible {
        background: linear-gradient(
          180deg,
          rgba(15, 23, 42, 0) 0%,
          rgba(15, 23, 42, 0) 14%,
          rgba(15, 23, 42, 0.14) 24%,
          rgba(15, 23, 42, 0.28) 52%,
          rgba(15, 23, 42, 0.42) 100%
        );
        backdrop-filter: blur(12px) saturate(1.07);
        -webkit-backdrop-filter: blur(12px) saturate(1.07);
      }

      .hero-dock-wrap {
        --dock-tone: 0;
        --bubble-tone: 0;
        --t: var(--dock-tone, 0);
      }

      /* Explicit height required: with height:auto, flex chat-thread (flex:1 1 0)
         collapses to 0 and messages vanish while the composer stays visible. */
      .hero-dock-wrap.docked.chat-engaged:not(.composer-hero-pin) {
        top: auto;
        bottom: var(--dock-gap, var(--hero-bottom-safe));
        display: flex;
        flex-direction: column;
        --hero-chat-max: min(
          58dvh,
          calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe) - 9rem)
        );
        height: min(
          calc(var(--hero-chat-max) + 7.5rem),
          calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe) - 1rem)
        );
        max-height: calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe) - 1rem);
        width: var(--hero-dock-chat-width);
        max-width: var(--hero-dock-chat-width);
      }
      .hero-overlay.chat-active .hero-dock-wrap.composer-hero-pin {
        top: auto;
        height: calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe));
        max-height: calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe));
        width: var(--hero-dock-chat-width);
        max-width: var(--hero-dock-chat-width);
      }

      /* Adaptive glass — tone 0: light frosted pill, tone 1: dark on light sections. */
      .hero-search {
        --t: var(--dock-tone, 0);
        background: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.2) calc((1 - var(--t)) * 100%),
          rgba(13, 18, 30, 0.92) calc(var(--t) * 100%)
        );
        backdrop-filter: blur(calc(16px + 4px * var(--t))) saturate(calc(1.1 + 0.15 * var(--t)));
        -webkit-backdrop-filter: blur(calc(16px + 4px * var(--t))) saturate(calc(1.1 + 0.15 * var(--t)));
        border: 1.5px solid color-mix(
          in srgb,
          rgba(255, 255, 255, 0.38) calc((1 - var(--t)) * 100%),
          rgba(255, 255, 255, 0.12) calc(var(--t) * 100%)
        );
        border-radius: 999px;
        box-shadow:
          0 4px 24px color-mix(
            in srgb,
            rgba(0, 0, 0, 0.12) calc((1 - var(--t)) * 100%),
            rgba(15, 23, 42, 0.2) calc(var(--t) * 100%)
          ),
          inset 0 1px 0 color-mix(
            in srgb,
            rgba(255, 255, 255, 0.22) calc((1 - var(--t)) * 100%),
            rgba(255, 255, 255, 0.06) calc(var(--t) * 100%)
          );
        transition:
          background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          border-color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          border-radius 0.55s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-search:focus-within {
        --t: var(--dock-tone, 0);
        background: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.22) calc((1 - var(--t)) * 100%),
          rgba(13, 18, 30, 0.96) calc(var(--t) * 100%)
        );
        border-color: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.55) calc((1 - var(--t)) * 100%),
          rgba(255, 255, 255, 0.18) calc(var(--t) * 100%)
        );
        box-shadow:
          0 8px 32px color-mix(
            in srgb,
            rgba(0, 0, 0, 0.16) calc((1 - var(--t)) * 100%),
            rgba(15, 23, 42, 0.28) calc(var(--t) * 100%)
          ),
          inset 0 1px 0 color-mix(
            in srgb,
            rgba(255, 255, 255, 0.3) calc((1 - var(--t)) * 100%),
            rgba(255, 255, 255, 0.08) calc(var(--t) * 100%)
          );
      }
      .hero-dock-wrap.hero-compressed .hero-search {
        border-radius: 1.25rem;
      }
      .hero-search input {
        background: transparent;
        color: rgba(255, 255, 255, calc(0.9 + var(--t, 0) * 0.1));
        outline: none;
        width: 100%;
        transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-search input::placeholder {
        color: rgba(255, 255, 255, calc(0.68 + var(--t, 0) * 0.1));
        transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-search input:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .hero-tool-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 1px solid color-mix(
          in srgb,
          rgba(255, 255, 255, 0.28) calc((1 - var(--t, 0)) * 100%),
          rgba(255, 255, 255, 0.22) calc(var(--t, 0) * 100%)
        );
        background: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.12) calc((1 - var(--t, 0)) * 100%),
          rgba(255, 255, 255, 0.1) calc(var(--t, 0) * 100%)
        );
        color: rgba(255, 255, 255, calc(0.82 + var(--t, 0) * 0.14));
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition:
          background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          border-color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-tool-btn:hover:not(:disabled) {
        background: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.22) calc((1 - var(--t, 0)) * 100%),
          rgba(255, 255, 255, 0.16) calc(var(--t, 0) * 100%)
        );
        border-color: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.42) calc((1 - var(--t, 0)) * 100%),
          rgba(255, 255, 255, 0.34) calc(var(--t, 0) * 100%)
        );
      }
      .hero-tool-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .hero-tool-btn.listening {
        background: rgba(239, 68, 68, 0.25);
        border-color: rgba(252, 165, 165, 0.6);
        color: #fecaca;
        animation: pulse 1.5s infinite;
      }
      .hero-tool-btn.active-toggle {
        background: rgba(0, 96, 234, 0.4);
        border-color: rgba(147, 197, 253, 0.6);
        color: #fff;
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      .search-btn {
        --t: var(--dock-tone, 0);
        background: color-mix(
          in srgb,
          #fff calc((1 - var(--t)) * 100%),
          #0060ea calc(var(--t) * 100%)
        );
        color: color-mix(
          in srgb,
          #0060ea calc((1 - var(--t)) * 100%),
          #fff calc(var(--t) * 100%)
        );
        border-radius: 999px;
        font-weight: 600;
        font-size: 14px;
        padding: 8px 20px;
        white-space: nowrap;
        transition:
          background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.1s ease,
          opacity 0.15s ease;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .search-btn:hover:not(:disabled) {
        background: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.94) calc((1 - var(--t)) * 100%),
          #0052c9 calc(var(--t) * 100%)
        );
        transform: scale(1.02);
      }
      .search-btn:active:not(:disabled) { transform: scale(0.98); }
      .search-btn:disabled { opacity: 0.7; cursor: not-allowed; }

      @keyframes spin { to { transform: rotate(360deg); } }
      .spinner {
        width: 16px; height: 16px;
        border: 2px solid color-mix(
          in srgb,
          rgba(0, 96, 234, 0.25) calc((1 - var(--t, 0)) * 100%),
          rgba(255, 255, 255, 0.25) calc(var(--t, 0) * 100%)
        );
        border-top-color: color-mix(
          in srgb,
          #0060ea calc((1 - var(--t, 0)) * 100%),
          #fff calc(var(--t, 0) * 100%)
        );
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        flex-shrink: 0;
      }

      .hero-copy,
      .hero-sub-link {
        transition:
          opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          transform 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
          margin 0.45s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }
      .hero-copy.collapsed,
      .hero-sub-link.collapsed {
        opacity: 0;
        transform: translateY(-16px);
        max-height: 0 !important;
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        pointer-events: none;
      }
      .hero-copy { max-height: 220px; }
      .hero-sub-link { max-height: 40px; }

      .hero-dock-wrap {
        --dock-progress: 0;
        --dock-width-progress: 0;
        width: min(
          calc(var(--hero-dock-min) + var(--hero-dock-grow) * var(--dock-width-progress)),
          calc(100vw - 2rem)
        );
        max-width: min(
          calc(var(--hero-dock-min) + var(--hero-dock-grow) * var(--dock-width-progress)),
          calc(100vw - 2rem)
        );
        margin-top: 2.25rem;
        margin-left: auto;
        margin-right: auto;
        transition:
          max-width 0.55s cubic-bezier(0.4, 0, 0.2, 1),
          width 0.55s cubic-bezier(0.4, 0, 0.2, 1),
          margin-top 0.55s cubic-bezier(0.4, 0, 0.2, 1);
        bottom: var(--dock-gap, auto);
      }
      .hero-overlay.chat-active .hero-dock-wrap {
        margin-top: 0;
        width: var(--hero-dock-chat-width);
        max-width: var(--hero-dock-chat-width);
      }
      .hero-overlay.chat-active .hero-dock-wrap.composer-hero-pin {
        flex: 1 1 auto;
        min-height: 0;
        height: calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe));
        max-height: calc(100dvh - var(--hero-nav-offset) - var(--hero-bottom-safe));
      }

      /* Pinned: center with margin (not left:50%+translateX) so width grows in place. */
      .hero-dock-wrap.docked {
        position: fixed;
        left: 0;
        right: 0;
        bottom: var(--dock-gap, var(--hero-bottom-safe));
        margin-left: auto;
        margin-right: auto;
        margin-top: 0;
        width: min(
          calc(var(--hero-dock-min) + var(--hero-dock-grow) * var(--dock-width-progress)),
          calc(100vw - 2rem)
        );
        max-width: min(
          calc(var(--hero-dock-min) + var(--hero-dock-grow) * var(--dock-width-progress)),
          calc(100vw - 2rem)
        );
        z-index: 50;
        isolation: isolate;
        transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .hero-dock-wrap.docked.dock-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(110%);
      }
      .hero-dock-wrap.docked.composer-hero-pin {
        width: var(--hero-dock-chat-width);
        max-width: var(--hero-dock-chat-width);
      }
      .hero-overlay.chat-active .hero-dock-wrap.docked {
        width: var(--hero-dock-chat-width);
        max-width: var(--hero-dock-chat-width);
      }

      .hero-dock {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: stretch;
        flex: 1 1 auto;
        min-height: 0;
      }
      .hero-dock-wrap.docked.chat-engaged .hero-dock {
        flex: 1 1 auto;
        min-height: 0;
        height: 100%;
      }

      .chat-thread {
        order: 1;
        width: 100%;
        opacity: 0;
        pointer-events: none;
        margin-bottom: 0;
        position: relative;
        z-index: 1;
        flex: 0 0 auto;
        min-height: 0;
        max-height: 0;
        overflow: hidden;
        transition:
          max-height 0.55s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1),
          margin-bottom 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          flex 0.55s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chat-thread.visible {
        opacity: 1;
        margin-bottom: 0.85rem;
        pointer-events: auto;
        flex: 1 1 0;
        min-height: 0;
        height: var(--hero-chat-max);
        max-height: var(--hero-chat-max);
        overflow: hidden;
      }
      .chat-thread-inner {
        position: relative;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        overscroll-behavior: contain;
      }
      /* Soft top edge only — never fully transparent, or scrolled messages vanish. */
      .chat-thread.visible .chat-thread-inner {
        -webkit-mask-image: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55) 0%,
          #000 12px,
          #000 100%
        );
        mask-image: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55) 0%,
          #000 12px,
          #000 100%
        );
      }

      .hero-composer {
        order: 2;
        flex: 0 0 auto;
        width: 100%;
        position: relative;
        z-index: 3;
      }

      app-destination-typeahead {
        display: block;
      }

      .chat-footer-note {
        margin-top: 0;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        font-size: 11px;
        color: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.5) calc((1 - var(--dock-tone, 0)) * 100%),
          rgba(255, 255, 255, 0.62) calc(var(--dock-tone, 0) * 100%)
        );
        text-align: center;
        transition:
          max-height 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
          margin-top 0.45s cubic-bezier(0.4, 0, 0.2, 1),
          color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .chat-footer-note.visible {
        margin-top: 8px;
        max-height: 2.5rem;
        opacity: 1;
        color: rgba(255, 255, 255, 0.72);
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
      }
      .advanced-planner-link {
        color: color-mix(
          in srgb,
          rgba(255, 255, 255, 0.75) calc((1 - var(--dock-tone, 0)) * 100%),
          rgba(255, 255, 255, 0.88) calc(var(--dock-tone, 0) * 100%)
        );
        text-decoration: underline;
        text-underline-offset: 2px;
        transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .hero-mute-btn {
        bottom: max(1.25rem, env(safe-area-inset-bottom, 0px) + 0.5rem);
      }

      @media (max-width: 640px) {
        :host {
          --hero-dock-chat-width: calc(100vw - 2rem);
        }
        .hero-overlay.chat-active .hero-dock-wrap {
          max-width: var(--hero-dock-chat-width);
          width: var(--hero-dock-chat-width);
        }
        .hero-tool-btn { width: 32px; height: 32px; }
      }

      @media (max-height: 760px) {
        :host {
          --hero-nav-offset: 4.25rem;
          --hero-chat-max: calc(100dvh - var(--hero-nav-offset) - 6rem);
        }
        .hero-overlay:not(.chat-active) {
          padding-top: 4.5rem;
          padding-bottom: 3rem;
        }
        .chat-footer-note.visible {
          margin-top: 6px;
          font-size: 10px;
          max-height: 2.25rem;
        }
      }

      @media (max-height: 640px) {
        :host {
          --hero-chat-max: calc(100dvh - var(--hero-nav-offset) - 5.5rem);
        }
        .hero-copy { max-height: 180px; }
        .hero-dock-wrap { margin-top: 1.5rem; }
        .chat-footer-note.visible { display: none; }
      }
    `,
    ],
    template: `
    <section class="w-full">
      <div
        class="composer-scrim"
        [class.visible]="composerScrimVisible()"
        [class.chat-visible]="chatShowThread()"
        aria-hidden="true"
        (click)="onComposerScrimClick()"
      ></div>
      <div #heroViewport class="hero-viewport w-full">
        <video
          #heroVideo
          class="absolute inset-0 h-full w-full object-cover"
          autoplay
          [muted]="isMuted()"
          loop
          playsinline
          preload="metadata"
          crossorigin="anonymous"
          poster="assets/images/landing/hero-bg.jpg"
          aria-hidden="true"
        >
          <source src="assets/videos/website_header.mp4" type="video/mp4" />
        </video>

        <div class="pointer-events-none absolute inset-x-0 top-0 h-[280px] bg-gradient-to-b from-black/55 to-transparent"></div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

        <div
          class="hero-overlay absolute inset-0 z-10 flex h-full min-h-0 flex-col items-center px-6 pb-12 pt-20 text-center sm:pb-16"
          [class.composer-front]="composerPinned()"
          [class.justify-center]="!heroCompressed()"
          [class.chat-active]="heroChatLayoutActive()"
        >
          <div class="hero-copy w-full shrink-0" [class.collapsed]="heroCompressed()">
            <h1 class="mx-auto max-w-[783px] text-[clamp(2.25rem,5vw,64px)] font-bold leading-[1.05] text-white"
                style="text-shadow: 0 2px 24px rgba(0,0,0,0.4);">
              {{ 'HERO.TITLE' | translate }}
            </h1>
            <p class="mx-auto mt-5 max-w-[480px] text-lg font-medium leading-relaxed text-white/85"
               style="text-shadow: 0 1px 8px rgba(0,0,0,0.4);">
              {{ 'HERO.SUBTITLE' | translate }}
            </p>
          </div>

          <div
            #heroDock
            class="hero-dock-wrap shrink-0"
            [class.hero-compressed]="heroCompressed()"
            [class.chat-engaged]="chatMode()"
            [class.docked]="composerPinned()"
            [class.composer-hero-pin]="composerPinned() && !scrollDocked()"
            [class.dock-hidden]="dockHidden()"
            [style.--dock-tone]="dockTone()"
            [style.--bubble-tone]="bubbleTone()"
            [style.--dock-progress]="dockProgress()"
            [style.--dock-width-progress]="dockWidthProgress()"
            [style.--dock-gap.px]="dockBottomPx()"
          >
            <div class="hero-dock">
              <div class="chat-thread" [class.visible]="chatShowThread()">
                <div class="chat-thread-inner">
                  <app-travel-chat-messages variant="hero" [threadVisible]="chatShowThread()" />
                </div>
              </div>

              <div class="hero-composer w-full">
                @if (chatMode() || heroCompressed()) {
                  <app-trip-slots-row tone="dark" />
                  <app-search-plan-assist tone="dark" />
                }

                <form
                  #heroSearch
                  class="hero-search flex w-full items-center gap-2 px-2 py-2 sm:px-3"
                  (submit)="onSubmit($event)"
                  (mousedown)="$event.stopPropagation()"
                  role="search"
                >
                @if (chat.sending()) {
                  <span class="ml-1 spinner"></span>
                } @else {
                  <button
                    type="button"
                    class="hero-tool-btn ml-1"
                    [class.listening]="chat.listening()"
                    (click)="chat.toggleVoice()"
                    [disabled]="chat.sending() || !chat.voiceSupported()"
                    [attr.aria-label]="(chat.listening() ? 'SHARED.STOP_VOICE_INPUT' : 'SHARED.VOICE_INPUT') | translate"
                    [attr.title]="chat.voiceSupported() ? ((chat.listening() ? 'SHARED.STOP_RECORDING' : 'SHARED.TALK_TO_PLAN_TRIP') | translate) : (chat.voiceUnavailableReason() || ('HERO.VOICE_UNAVAILABLE' | translate))"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"/>
                      <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke-linecap="round"/>
                    </svg>
                  </button>
                }

                @if (chatMode() && chat.hasConversation() && !chat.listening()) {
                  <button
                    type="button"
                    class="hero-tool-btn"
                    (click)="onNewChat()"
                    [attr.aria-label]="'SHARED.NEW_CHAT' | translate"
                    [attr.title]="'SHARED.NEW_CHAT' | translate"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                  </button>
                }

                @if (chatMode() && chat.ttsSupported && !chat.listening()) {
                  <button
                    type="button"
                    class="hero-tool-btn"
                    [class.active-toggle]="chat.voiceRepliesEnabled()"
                    (click)="chat.toggleVoiceReplies()"
                    [attr.aria-label]="(chat.voiceRepliesEnabled() ? 'SHARED.VOICE_REPLIES_ON' : 'SHARED.VOICE_REPLIES_OFF') | translate"
                    [attr.title]="(chat.voiceRepliesEnabled() ? 'SHARED.VOICE_REPLIES_ON' : 'SHARED.VOICE_REPLIES_OFF') | translate"
                  >
                    @if (chat.voiceRepliesEnabled()) {
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M4 9v6h3.5l4.5 4V5l-4.5 4H4Z" stroke-linejoin="round"/>
                        <path d="M16 9.5c1 1 1 4 0 5M18.5 7.5c2 2 2 7 0 9" stroke-linecap="round"/>
                      </svg>
                    } @else {
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <path d="M4 9v6h3.5l4.5 4V5l-4.5 4H4Z" stroke-linejoin="round"/>
                        <path d="M16.5 9.5l4 4M20.5 9.5l-4 4" stroke-linecap="round"/>
                      </svg>
                    }
                  </button>
                }

                <input
                  #searchInput
                  type="text"
                  [placeholder]="searchPlaceholder() | translate"
                  class="min-w-0 flex-1 py-1 text-sm-plus font-medium"
                  [class.italic]="chat.listening()"
                  [attr.aria-label]="'SHARED.DESCRIBE_YOUR_TRIP' | translate"
                  role="combobox"
                  aria-autocomplete="list"
                  [attr.aria-expanded]="typeaheadExpanded()"
                  aria-controls="hero-dest-listbox"
                  [attr.aria-activedescendant]="heroTypeahead()?.activeOptionId() ?? null"
                  [disabled]="chat.sending()"
                  [readonly]="chat.listening()"
                  (input)="onInputChange()"
                  (focus)="onInputFocus()"
                  (blur)="onInputBlur()"
                  (keydown)="onSearchKeydown($event)"
                />

                @if (inputValue().trim() && !chat.sending() && !chat.listening()) {
                  <button
                    type="button"
                    class="hero-tool-btn"
                    (mousedown)="$event.preventDefault()"
                    (click)="clearInput()"
                    [attr.aria-label]="'HERO.CLEAR_SEARCH' | translate"
                    [attr.title]="'HERO.CLEAR_SEARCH' | translate"
                  >
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/>
                    </svg>
                  </button>
                }

                <button
                  type="submit"
                  class="search-btn"
                  [disabled]="!chat.sending() && !inputValue().trim()"
                  (click)="chat.sending() ? onStopGenerating($event) : null"
                  [attr.aria-label]="(chat.sending() ? 'SHARED.STOP_GENERATING' : 'SHARED.SEND_MESSAGE') | translate"
                >
                  @if (chat.sending()) {
                    ◼ {{ 'SHARED.STOP' | translate }}
                  } @else {
                    {{ (chatMode() || composerPinned() ? 'HERO.SEND' : 'HERO.PLAN_TRIP') | translate }}
                    <svg class="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                      @if (chatMode() || composerPinned()) {
                        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                      } @else {
                        <path d="M3 11L11 3M11 3H5.5M11 3V8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      }
                    </svg>
                  }
                </button>
              </form>

                <app-destination-typeahead
                  listboxId="hero-dest-listbox"
                  [query]="inputValue()"
                  [enabled]="typeaheadEnabled()"
                  presentation="chips"
                  variant="glass"
                  (picked)="onTypeaheadPicked($event)"
                />

                <p class="chat-footer-note" [class.visible]="chatShowThread()" [innerHTML]="'HERO.FOOTER_NOTE' | translate">
                </p>
              </div>
            </div>
          </div>

          <div class="hero-sub-link mt-5 flex shrink-0 flex-wrap items-center justify-center gap-1" [class.collapsed]="heroCompressed()">
            <app-animated-link
              variant="underline-center"
              routerLink="/how-it-works"
              class="text-sm font-medium text-white/70"
            >
              {{ 'HERO.SEE_HOW' | translate }}
            </app-animated-link>
            @if (!heroCompressed()) {
              <span class="mx-3 text-white/30" aria-hidden="true">·</span>
              <a
                routerLink="/packages"
                class="text-sm font-medium text-white/70 no-underline transition-colors hover:text-white"
              >
                {{ 'HERO.BROWSE_PACKAGES' | translate }}
              </a>
            }
          </div>
        </div>

        <div
          class="scroll-indicator absolute bottom-9 left-1/2 z-20 -translate-x-1/2 flex flex-col items-center gap-1.5"
          [class.hidden-cue]="scrolled() || heroCompressed()"
          aria-hidden="true"
        >
          <span class="text-2xs font-medium uppercase tracking-[0.2em] text-white/50">{{ 'HERO.SCROLL' | translate }}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 7L10 13L16 7" stroke="rgba(255,255,255,0.6)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <button
          type="button"
          class="hero-mute-btn absolute right-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/25 backdrop-blur-sm transition-colors hover:bg-black/45 xl:right-8"
          [attr.aria-label]="(isMuted() ? 'HERO.UNMUTE_VIDEO' : 'HERO.MUTE_VIDEO') | translate"
          (click)="toggleMute()"
        >
          <img
            [src]="isMuted() ? 'assets/images/icons/mute.svg' : 'assets/images/icons/volume.svg'"
            alt=""
            class="h-5 w-5"
            aria-hidden="true"
          />
        </button>
      </div>
    </section>
  `
})
export class HeroSectionComponent implements AfterViewInit, OnDestroy {
  private readonly heroVideo = viewChild<ElementRef<HTMLVideoElement>>('heroVideo');
  private readonly heroViewport = viewChild<ElementRef<HTMLElement>>('heroViewport');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly heroDock = viewChild<ElementRef<HTMLElement>>('heroDock');
  private readonly heroSearch = viewChild<ElementRef<HTMLFormElement>>('heroSearch');
  readonly heroTypeahead = viewChild(DestinationTypeaheadComponent);

  readonly chat = inject(TravelChatSessionService);
  private readonly chatContext = inject(ChatContextService);
  private readonly destinationSearch = inject(DestinationSearchService);

  readonly typeaheadEnabled = computed(
    () =>
      !this.chat.sending() &&
      !this.chat.listening() &&
      (!this.chat.hasConversation() || this.inputValue().trim().length >= 2),
  );

  readonly typeaheadExpanded = computed(
    () => this.typeaheadEnabled() && (this.heroTypeahead()?.isOpen() ?? false),
  );

  onSearchKeydown(event: KeyboardEvent): void {
    if (this.heroTypeahead()?.handleKeydown(event)) return;
  }

  onTypeaheadPicked(item: DestinationListItem): void {
    const input = this.searchInput()?.nativeElement;
    if (input) input.value = '';
    this.inputValue.set('');
    this.openChat();
    void this.chat.planDestination(item.name);
  }

  clearInput(): void {
    const input = this.searchInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    this.inputValue.set('');
    this.heroTypeahead()?.resetActiveIndex();
    if (!this.chat.hasConversation() && !this.chat.sending() && !this.chat.listening()) {
      this.chatMode.set(false);
    }
  }

  readonly isMuted = signal(true);
  readonly scrolled = signal(false);
  /** 0 (resting in the hero) to 1 (fully docked at the bottom of the
   * viewport). Driven continuously from scroll position so the dock eases
   * into place instead of snapping. */
  readonly dockProgress = signal(0);
  /** Eased 0→1 width growth while scrolling — slower start, full 920px at end. */
  readonly dockWidthProgress = signal(0);
  readonly docked = computed(() => this.dockProgress() > 0);
  readonly scrollDocked = computed(() => this.dockProgress() > 0);
  /** Fixed to viewport bottom — scroll dock or typing on the hero. */
  readonly composerPinned = computed(
    () => this.scrollDocked() || (this.heroCompressed() && !this.pastHero()),
  );
  readonly composerScrimVisible = computed(
    () => this.heroCompressed() || this.chatShowThread(),
  );
  /** Interpolated `bottom` offset (px) while docked; null lets the dock sit
   * in normal flow within the hero. */
  readonly dockBottomPx = signal<number | null>(null);
  /** 0 = light glass on dark bg, 1 = dark glass on light bg — search bar. */
  readonly dockTone = signal(0);
  /** Separate tone for chat bubbles/chips — sampled above the search bar. */
  readonly bubbleTone = signal(0);
  /** True once the user has scrolled past the hero. */
  readonly pastHero = signal(false);
  readonly dockHidden = signal(false);
  readonly chatMode = signal(false);
  /** Compresses the hero (hide headline, pin search low) — typing, voice, or an
   * active in-session chat. Persisted history / leftover duration chips alone
   * must not collapse the hero on a fresh landing-page load. */
  readonly heroCompressed = computed(
    () =>
      this.inputValue().trim().length > 0 ||
      this.chat.sending() ||
      this.chat.listening() ||
      (this.chatMode() && this.chat.hasConversation()),
  );
  /** Full hero chat layout — not used for scroll-docked bottom composer while merely typing. */
  readonly heroChatLayoutActive = computed(
    () =>
      this.heroCompressed() &&
      (!this.scrollDocked() ||
        this.chat.hasConversation() ||
        this.chat.sending() ||
        this.chat.listening()),
  );
  /** Greeting/chips while composing on the hero; full history once there is a back-and-forth. */
  readonly chatShowThread = computed(() => {
    if (!this.chatMode()) return false;
    if (this.chat.sending() || this.chat.listening()) return true;
    if (this.chat.hasConversation()) return true;
    if (this.scrollDocked()) return false;
    if (this.heroCompressed()) return true;
    return this.pastHero() || this.scrollDocked();
  });
  readonly inputValue = signal('');
  private ignoreOutsideClickUntil = 0;
  private searchObserver: IntersectionObserver | null = null;
  private heroViewportObserver: IntersectionObserver | null = null;

  /** Gap (px) between the dock's bottom edge and the viewport bottom while
   * it's still resting in normal flow — measured once so the fixed-position
   * takeover starts from an identical spot and eases down from there. */
  private dockRestGap = 16;
  private static readonly DOCK_FINAL_GAP = 16;
  private wasPinned = false;
  /** Scroll distance over which the dock widens — most of the hero for a slow expand. */
  private static readonly DOCK_WIDTH_SCROLL_FACTOR = 0.88;
  /** Scroll distance over which the dock reaches the viewport bottom. */
  private static readonly DOCK_PIN_SCROLL_FACTOR = 0.55;
  private dockToneTarget = 0;
  private bubbleToneTarget = 0;
  private toneAnimFrame: number | null = null;
  private toneMonitorRaf: number | null = null;
  private lastToneSampleAt = 0;
  private toneSampleCanvas: HTMLCanvasElement | null = null;
  private static readonly TONE_LERP = 0.2;
  private static readonly TONE_SAMPLE_MS = 90;
  /** Pending rAF handle for scroll-triggered tone samples; guards against
   * queuing a second frame while the first hasn't fired yet. */
  private scrollToneRaf: number | null = null;

  private static readonly IDLE_PLACEHOLDERS = [
    'HERO.PLACEHOLDER',
    'HERO.PLACEHOLDER_ALT_1',
    'HERO.PLACEHOLDER_ALT_2',
  ];
  /** Cycles the idle placeholder with trip-shaped examples for search-bar planning. */
  private readonly idlePlaceholderIndex = signal(0);
  private readonly placeholderLocked = signal(false);
  private idlePlaceholderTimer: ReturnType<typeof setInterval> | null = null;

  /** Returns an i18n key; the template pipes it through translate. */
  readonly searchPlaceholder = computed(() => {
    if (this.chat.listening()) {
      return 'HERO.LISTENING';
    }
    if (this.chatMode() && this.chat.hasConversation()) {
      return 'HERO.CHAT_PLACEHOLDER';
    }
    if (this.chatMode() || this.composerPinned()) {
      return 'HERO.DOCKED_PLACEHOLDER';
    }
    if (this.placeholderLocked()) {
      return 'HERO.PLACEHOLDER';
    }
    return HeroSectionComponent.IDLE_PLACEHOLDERS[this.idlePlaceholderIndex()];
  });

  constructor() {
    // TravelChatSessionService is a root singleton, so composerPrefillVersion
    // outlives this component — a value of 0 only means "no prefill has ever
    // happened in this session," not "nothing new for this component
    // instance." Baseline against whatever version already existed at
    // construction time, so revisiting this route after an unrelated prefill
    // fired elsewhere (e.g. Explore's "Start planning") doesn't replay it.
    const initialPrefillVersion = this.chat.composerPrefillVersion();

    if (typeof window !== 'undefined') {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        this.idlePlaceholderTimer = setInterval(() => {
          if (this.placeholderLocked()) return;
          this.idlePlaceholderIndex.update((i) => (i + 1) % HeroSectionComponent.IDLE_PLACEHOLDERS.length);
        }, 4500);
      }
    }

    effect(() => {
      if (this.chat.sending() || this.chat.listening()) {
        this.chatMode.set(true);
      }
    }, { allowSignalWrites: true });

    // Mirror the live transcript into the input while dictating, so the user
    // watches their words land as real text instead of a faint placeholder.
    // When listening ends the service auto-sends the transcript, so the
    // composer resets rather than leaving already-sent text behind.
    let wasListening = false;
    effect(() => {
      const listening = this.chat.listening();
      const live = this.chat.interimTranscript();
      const input = this.searchInput()?.nativeElement;
      if (listening) {
        wasListening = true;
        if (input && live) {
          input.value = live;
          this.inputValue.set(live);
        }
      } else if (wasListening) {
        wasListening = false;
        if (input) input.value = '';
        this.inputValue.set('');
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.chatContext.setHeroChatActive(this.chatMode());
    }, { allowSignalWrites: true });

    effect(() => {
      // Padding / clearance follows the pinned composer even when the dock is
      // visually tucked near the footer — tying it to dockHidden reflowed the
      // page and caused a scroll jump.
      this.chatContext.setHeroDockPinned(this.composerPinned());
    }, { allowSignalWrites: true });

    effect(() => {
      const pinned = this.composerPinned();
      const scrollDocked = this.scrollDocked();
      if (pinned && !scrollDocked) {
        this.dockBottomPx.set(HeroSectionComponent.DOCK_FINAL_GAP);
      } else if (!scrollDocked) {
        this.dockBottomPx.set(null);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      this.chatMode();
      this.heroCompressed();
      this.docked();
      this.pastHero();
      if (typeof window !== 'undefined') {
        this.scheduleToneSample();
      }
    });

    effect(() => {
      const version = this.chat.composerPrefillVersion();
      if (version <= initialPrefillVersion) return;
      const text = this.chat.composerPrefillText();
      this.openChat();
      const input = this.searchInput()?.nativeElement;
      if (input) {
        input.value = text;
        input.focus();
        input.setSelectionRange(text.length, text.length);
      }
      this.inputValue.set(text);
    }, { allowSignalWrites: true });
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') {
      return;
    }

    queueMicrotask(() => {
      this.observeSearchVisibility();
      this.observeHeroViewport();
      this.observeFooterProximity();
      this.measureDockRestGap();
      this.updateDockProgress(window.scrollY);
      this.scheduleToneSample();
      this.startToneMonitor();
      const video = this.heroVideo()?.nativeElement;
      if (video) {
        const onVideoReady = () => this.scheduleToneSample();
        video.addEventListener('loadeddata', onVideoReady, { once: true });
        video.addEventListener('seeked', onVideoReady);
      }
    });
  }

  private footerObserver: IntersectionObserver | null = null;
  /** Debounce footer hide/show so threshold chatter doesn't blink the dock. */
  private footerHideTimer: ReturnType<typeof setTimeout> | null = null;

  private observeFooterProximity(): void {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const footer = document.querySelector('app-footer-section');
    if (!footer) return;

    this.footerObserver?.disconnect();
    this.footerObserver = new IntersectionObserver(
      ([entry]) => {
        // Soften only — never fully hide/show the dock on footer threshold
        // chatter (that read as a scroll glitch). Keep it usable while chatting.
        const deepOverlap = entry.intersectionRatio >= 0.35 && !this.chatMode();
        if (this.footerHideTimer) {
          clearTimeout(this.footerHideTimer);
          this.footerHideTimer = null;
        }
        this.footerHideTimer = setTimeout(() => {
          this.footerHideTimer = null;
          this.dockHidden.set(deepOverlap);
        }, deepOverlap ? 200 : 280);
      },
      { threshold: [0, 0.2, 0.35, 0.5], rootMargin: '0px 0px -40px 0px' },
    );
    this.footerObserver.observe(footer);
  }

  ngOnDestroy(): void {
    this.searchObserver?.disconnect();
    this.searchObserver = null;
    this.heroViewportObserver?.disconnect();
    this.heroViewportObserver = null;
    this.footerObserver?.disconnect();
    this.footerObserver = null;
    if (this.footerHideTimer) {
      clearTimeout(this.footerHideTimer);
      this.footerHideTimer = null;
    }
    this.chatContext.setHeroSearchInView(false);
    this.chatContext.setHeroViewportInView(false);
    this.chatContext.setHeroChatActive(false);
    this.chatContext.setHeroDockPinned(false);
    if (this.idlePlaceholderTimer) clearInterval(this.idlePlaceholderTimer);
    if (this.toneAnimFrame !== null) {
      cancelAnimationFrame(this.toneAnimFrame);
      this.toneAnimFrame = null;
    }
    if (this.toneMonitorRaf !== null) {
      cancelAnimationFrame(this.toneMonitorRaf);
      this.toneMonitorRaf = null;
    }
    if (this.scrollToneRaf !== null) {
      cancelAnimationFrame(this.scrollToneRaf);
      this.scrollToneRaf = null;
    }
    this.toneSampleCanvas = null;
  }

  private observeSearchVisibility(): void {
    const search = this.heroSearch()?.nativeElement;
    if (!search || typeof IntersectionObserver === 'undefined') {
      this.chatContext.setHeroSearchInView(false);
      return;
    }

    this.searchObserver?.disconnect();
    const initiallyVisible = (() => {
      const rect = search.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    })();
    this.chatContext.setHeroSearchInView(initiallyVisible);

    this.searchObserver = new IntersectionObserver(
      ([entry]) => {
        this.chatContext.setHeroSearchInView(entry.isIntersecting);
      },
      // Negative bottom margin: treat the bar as "gone" only once it's well
      // off-screen, so threshold chatter at the edge doesn't flicker the
      // floating dock handoff on non-home pages.
      { threshold: [0, 0.01, 0.1], rootMargin: '0px 0px -48px 0px' },
    );
    this.searchObserver.observe(search);
  }

  private observeHeroViewport(): void {
    const viewport = this.heroViewport()?.nativeElement;
    if (!viewport || typeof IntersectionObserver === 'undefined') {
      this.chatContext.setHeroViewportInView(false);
      return;
    }

    this.heroViewportObserver?.disconnect();
    const initiallyVisible = (() => {
      const rect = viewport.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    })();
    this.chatContext.setHeroViewportInView(initiallyVisible);

    this.heroViewportObserver = new IntersectionObserver(
      ([entry]) => {
        this.chatContext.setHeroViewportInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px' },
    );
    this.heroViewportObserver.observe(viewport);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;
    this.scrolled.set(y > 60);
    this.updateDockProgress(y);
    this.scheduleToneSample();
  }

  @HostListener('window:resize')
  onResize(): void {
    // Re-measure the resting gap while at (or very near) the top, since the
    // hero's flex layout can reflow with viewport size.
    if (window.scrollY < 4) {
      this.measureDockRestGap();
    }
    this.updateDockProgress(window.scrollY);
    this.scheduleToneSample();
  }

  private measureDockRestGap(): void {
    const el = this.heroDock()?.nativeElement;
    if (!el || typeof window === 'undefined') return;
    const gap = window.innerHeight - el.getBoundingClientRect().bottom;
    if (Number.isFinite(gap) && gap > 0) {
      this.dockRestGap = gap;
    }
  }

  private updateDockProgress(y: number): void {
    if (typeof window === 'undefined') return;

    const heroHeight = this.heroViewport()?.nativeElement.offsetHeight || window.innerHeight;
    const widthRange = Math.max(heroHeight * HeroSectionComponent.DOCK_WIDTH_SCROLL_FACTOR, 1);
    const pinRange = Math.max(heroHeight * HeroSectionComponent.DOCK_PIN_SCROLL_FACTOR, 1);

    const widthLinear = Math.min(1, Math.max(0, y / widthRange));
    const pinLinear = Math.min(1, Math.max(0, y / pinRange));

    // Smoothstep — slow start, gradual widen across most of the hero scroll.
    const widthEased = widthLinear * widthLinear * (3 - 2 * widthLinear);
    this.dockWidthProgress.set(widthEased);
    this.dockProgress.set(pinLinear);
    this.pastHero.set(y > heroHeight * 0.4);

    if (pinLinear >= 1) {
      this.dockBottomPx.set(HeroSectionComponent.DOCK_FINAL_GAP);
      this.wasPinned = true;
      return;
    }

    if (pinLinear <= 0) {
      this.dockBottomPx.set(null);
      this.dockWidthProgress.set(0);
      if (this.wasPinned) {
        this.scheduleToneSample();
      }
      this.pastHero.set(false);
      this.wasPinned = false;
      return;
    }

    const dock = this.heroDock()?.nativeElement;
    if (!this.wasPinned && dock) {
      const rect = dock.getBoundingClientRect();
      const liveGap = window.innerHeight - rect.bottom;
      if (Number.isFinite(liveGap) && liveGap > 0) {
        this.dockRestGap = liveGap;
      }
      this.wasPinned = true;
    }

    const pinEased = 1 - Math.pow(1 - pinLinear, 3);
    const gap =
      this.dockRestGap +
      (HeroSectionComponent.DOCK_FINAL_GAP - this.dockRestGap) * pinEased;
    this.dockBottomPx.set(Math.round(gap));
  }

  private startToneMonitor(): void {
    if (typeof window === 'undefined' || this.toneMonitorRaf !== null) return;

    const loop = (ts: number): void => {
      // Only continuous-sample while the bar is still over the hero video.
      // Once docked over page content, tone is locked (see updateDockTone).
      if (!this.pastHero() && !this.scrollDocked()) {
        if (ts - this.lastToneSampleAt >= HeroSectionComponent.TONE_SAMPLE_MS) {
          this.lastToneSampleAt = ts;
          this.updateDockTone();
        }
      }
      this.toneMonitorRaf = requestAnimationFrame(loop);
    };
    this.toneMonitorRaf = requestAnimationFrame(loop);
  }

  private scheduleToneSample(): void {
    if (typeof document.elementsFromPoint !== 'function') return;
    // Skip if the continuous monitor already sampled within the last interval —
    // this prevents duplicate layout reads when scroll and the rAF loop fire
    // in the same frame.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastToneSampleAt < HeroSectionComponent.TONE_SAMPLE_MS) return;
    if (this.scrollToneRaf !== null) return; // already one queued
    this.scrollToneRaf = requestAnimationFrame(() => {
      this.scrollToneRaf = null;
      this.lastToneSampleAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.updateDockTone();
    });
  }

  /** Samples luminance directly behind the search bar and eases --dock-tone. */
  private updateDockTone(): void {
    const dock = this.heroDock()?.nativeElement;
    const search = this.heroSearch()?.nativeElement;
    if (!dock || !search || typeof window === 'undefined') return;

    const rect = search.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    // Past the hero the bar sits over light page content — lock dark glass.
    // Continuous sampling over cards/footer caused visible tone flicker.
    if (this.pastHero() || this.scrollDocked()) {
      this.setToneTargets(1, this.chatMode() || this.chat.hasConversation() ? 0 : 1);
      return;
    }

    const searchLum = this.sampleLuminanceBehindSearch(search, dock);
    const chatLum = this.sampleLuminanceBehindChat(dock, search);
    let searchTarget = HeroSectionComponent.luminanceToTone(searchLum);
    let bubbleTarget = HeroSectionComponent.luminanceToTone(chatLum);

    if (this.chatMode() || this.chat.hasConversation()) {
      bubbleTarget = 0;
    }

    if (this.chatMode() || this.heroCompressed()) {
      searchTarget = Math.max(0.22, Math.min(searchTarget, 0.34));
    } else {
      searchTarget = 0;
    }

    this.setToneTargets(searchTarget, bubbleTarget);
  }

  private setToneTargets(dockTarget: number, bubbleTarget: number): void {
    this.dockToneTarget = Math.min(1, Math.max(0, dockTarget));
    this.bubbleToneTarget = Math.min(1, Math.max(0, bubbleTarget));
    this.animateTones();
  }

  private animateTones(): void {
    if (this.toneAnimFrame !== null) return;

    const step = (): void => {
      const dockCurrent = this.dockTone();
      const bubbleCurrent = this.bubbleTone();
      const dockDiff = this.dockToneTarget - dockCurrent;
      const bubbleDiff = this.bubbleToneTarget - bubbleCurrent;
      if (Math.abs(dockDiff) < 0.004 && Math.abs(bubbleDiff) < 0.004) {
        this.dockTone.set(this.dockToneTarget);
        this.bubbleTone.set(this.bubbleToneTarget);
        this.toneAnimFrame = null;
        return;
      }
      const lerp =
        Math.abs(dockDiff) > 0.35 || Math.abs(bubbleDiff) > 0.35
          ? 0.32
          : HeroSectionComponent.TONE_LERP;
      this.dockTone.set(dockCurrent + dockDiff * lerp);
      this.bubbleTone.set(bubbleCurrent + bubbleDiff * lerp);
      this.toneAnimFrame = requestAnimationFrame(step);
    };
    this.toneAnimFrame = requestAnimationFrame(step);
  }

  /** Samples behind the search pill — min when dark accents sit under the bar. */
  private sampleLuminanceBehindSearch(search: HTMLElement, dock: HTMLElement): number {
    const prevPe = dock.style.pointerEvents;
    dock.style.pointerEvents = 'none';
    try {
      const rect = search.getBoundingClientRect();
      const xs = [0.15, 0.3, 0.45, 0.5, 0.55, 0.7, 0.85].map((f) => rect.left + rect.width * f);
      const ys = [rect.top + rect.height * 0.55, rect.top + rect.height * 0.85, rect.top + 2];
      const samples: number[] = [];
      for (const y of ys) {
        for (const x of xs) {
          samples.push(this.resolveBackdropLuminance(x, y));
        }
      }
      return HeroSectionComponent.blendSearchLuminance(samples);
    } finally {
      dock.style.pointerEvents = prevPe;
    }
  }

  /** Samples behind the chat thread — median of the area above the search bar. */
  private sampleLuminanceBehindChat(dock: HTMLElement, search: HTMLElement): number {
    const prevPe = dock.style.pointerEvents;
    dock.style.pointerEvents = 'none';
    try {
      const searchRect = search.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      const threadHeight = Math.max(24, searchRect.top - dockRect.top);
      const y = searchRect.top - threadHeight * 0.45;
      const xs = [0.3, 0.45, 0.5, 0.55, 0.7].map((f) => searchRect.left + searchRect.width * f);
      const samples = xs.map((x) => this.resolveBackdropLuminance(x, y));
      return HeroSectionComponent.median(samples);
    } finally {
      dock.style.pointerEvents = prevPe;
    }
  }

  private static blendSearchLuminance(samples: number[]): number {
    if (samples.length === 0) return 128;
    const sorted = [...samples].sort((a, b) => a - b);
    const min = sorted[0]!;
    const median = HeroSectionComponent.median(sorted);
    if (min < 115 && median - min > 40) return min;
    return median;
  }

  private static median(values: number[]): number {
    if (values.length === 0) return 128;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  }

  /** Finds the painted backdrop at a viewport point. */
  private resolveBackdropLuminance(x: number, y: number): number {
    if (typeof document.elementFromPoint !== 'function') return 128;
    const el = document.elementFromPoint(x, y);
    if (!el) return 128;
    const lum = this.findPaintedLuminance(el as HTMLElement, x, y);
    return lum ?? 128;
  }

  private findPaintedLuminance(el: HTMLElement, x: number, y: number): number | null {
    let cursor: HTMLElement | null = el;
    while (cursor && cursor !== document.documentElement) {
      if (cursor.tagName === 'VIDEO') {
        const lum = this.sampleVideoPixelLuminance(cursor as HTMLVideoElement, x, y);
        return lum ?? this.estimateHeroVideoLuminance(y);
      }
      if (cursor.tagName === 'IMG') {
        const lum = this.sampleImagePixelLuminance(cursor as HTMLImageElement, x, y);
        if (lum !== null) return lum;
      }

      const layer = this.readSolidBackground(cursor);
      if (layer !== null && layer.alpha >= 0.45) {
        return layer.lum;
      }
      cursor = cursor.parentElement;
    }
    return null;
  }

  private readSolidBackground(el: HTMLElement): { lum: number; alpha: number } | null {
    const candidate = window.getComputedStyle(el).backgroundColor;
    if (!candidate || /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*0\s*\)/.test(candidate)) {
      return null;
    }

    const lum = HeroSectionComponent.resolveColorLuminance(candidate);
    const alphaMatch = candidate.match(
      /rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/,
    );
    const alpha = alphaMatch ? Number(alphaMatch[1]) : 1;
    return { lum, alpha };
  }

  private sampleVideoPixelLuminance(video: HTMLVideoElement, x: number, y: number): number | null {
    if (video.readyState < 2 || !video.videoWidth) return null;
    try {
      const canvas = this.toneSampleCanvas ??= document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const vr = video.getBoundingClientRect();
      if (vr.width <= 0 || vr.height <= 0) return null;
      if (x < vr.left || x > vr.right || y < vr.top || y > vr.bottom) return null;

      const sx = ((x - vr.left) / vr.width) * video.videoWidth;
      const sy = ((y - vr.top) / vr.height) * video.videoHeight;

      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(video, sx, sy, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    } catch {
      return null;
    }
  }

  private sampleImagePixelLuminance(img: HTMLImageElement, x: number, y: number): number | null {
    if (!img.complete || !img.naturalWidth) return null;
    try {
      const canvas = this.toneSampleCanvas ??= document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      const ir = img.getBoundingClientRect();
      if (ir.width <= 0 || ir.height <= 0) return null;
      if (x < ir.left || x > ir.right || y < ir.top || y > ir.bottom) return null;

      const sx = ((x - ir.left) / ir.width) * img.naturalWidth;
      const sy = ((y - ir.top) / ir.height) * img.naturalHeight;

      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    } catch {
      return null;
    }
  }

  /** Hero video is dark at the top and bright (clouds/mist) toward the bottom. */
  private estimateHeroVideoLuminance(y: number): number {
    const hero = this.heroViewport()?.nativeElement;
    if (!hero) return 140;
    const rect = hero.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (y - rect.top) / rect.height));
    if (fraction < 0.42) return 50 + fraction * 90;
    if (fraction < 0.7) return 88 + (fraction - 0.42) * 220;
    return 200 + (fraction - 0.7) * 185;
  }

  /** Maps background luminance (0–255) to dock tone with a soft S-curve. */
  private static luminanceToTone(luminance: number): number {
    if (luminance < 130) return 0;
    const linear = (luminance - 130) / (182 - 130);
    const clamped = Math.min(1, Math.max(0, linear));
    return clamped * clamped * (3 - 2 * clamped);
  }

  private static colorProbeCtx: CanvasRenderingContext2D | null = null;

  private static resolveColorLuminance(cssColor: string): number {
    const direct = HeroSectionComponent.parseLuminanceFromString(cssColor);
    if (direct !== null) return direct;

    if (typeof document === 'undefined') return 128;
    if (!HeroSectionComponent.colorProbeCtx) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      HeroSectionComponent.colorProbeCtx = canvas.getContext('2d');
    }
    const ctx = HeroSectionComponent.colorProbeCtx;
    if (!ctx) return 128;
    try {
      ctx.fillStyle = '#000000';
      ctx.fillStyle = cssColor;
      const normalized = ctx.fillStyle;
      return HeroSectionComponent.parseLuminanceFromString(normalized) ?? 128;
    } catch {
      return 128;
    }
  }

  private static parseLuminanceFromString(cssColor: string): number | null {
    const rgb = cssColor.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (rgb) {
      return (
        0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])
      );
    }
    const hex6 = cssColor.match(/^#([0-9a-f]{6})$/i);
    if (hex6) {
      const h = hex6[1]!;
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const hex3 = cssColor.match(/^#([0-9a-f]{3})$/i);
    if (hex3) {
      const h = hex3[1]!;
      const r = parseInt(h[0]! + h[0], 16);
      const g = parseInt(h[1]! + h[1], 16);
      const b = parseInt(h[2]! + h[2], 16);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    return null;
  }

  private static parseLuminance(cssColor: string): number {
    return HeroSectionComponent.resolveColorLuminance(cssColor);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.chatMode()) {
      event.preventDefault();
      this.closeChat();
      return;
    }
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
    event.preventDefault();
    this.searchInput()?.nativeElement.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (Date.now() < this.ignoreOutsideClickUntil) return;
    if (!this.chatMode() || this.chat.sending() || this.chat.listening()) return;

    const dock = this.heroDock()?.nativeElement;
    const target = event.target as Node | null;
    if (dock && target && !dock.contains(target)) {
      this.closeChat();
    }
  }

  onComposerScrimClick(): void {
    if (this.chat.sending() || this.chat.listening()) return;
    if (!this.chat.hasConversation()) {
      this.closeChat();
    }
  }

  onInputFocus(): void {
    this.destinationSearch.load();
    this.placeholderLocked.set(true);
  }

  onInputBlur(): void {
    if (!this.inputValue().trim()) {
      this.placeholderLocked.set(false);
    }
  }

  onInputChange(): void {
    const query = this.searchInput()?.nativeElement.value ?? '';
    this.inputValue.set(query);
    this.heroTypeahead()?.resetActiveIndex();
    if (query.trim().length > 0) {
      this.openChat();
    } else if (!this.chat.hasConversation() && !this.chat.sending() && !this.chat.listening()) {
      this.chatMode.set(false);
    }
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.chat.listening()) {
      // Submitting mid-dictation stops the recognizer; its onend handler
      // sends the full transcript, so sending here too would double-submit.
      await this.chat.toggleVoice();
      return;
    }
    const query = this.searchInput()?.nativeElement.value.trim();
    if (!query || this.chat.sending()) return;

    this.openChat();
    const input = this.searchInput()?.nativeElement;
    if (input) input.value = '';
    this.inputValue.set('');

    await this.chat.planFromSearchQuery(query);
    queueMicrotask(() => this.searchInput()?.nativeElement?.focus());
  }

  onStopGenerating(event: Event): void {
    event.preventDefault();
    this.chat.stopGenerating();
  }

  onNewChat(): void {
    this.chat.clearHistory();
    const input = this.searchInput()?.nativeElement;
    if (input) {
      input.value = '';
      input.focus();
    }
    this.inputValue.set('');
  }

  private openChat(): void {
    this.ignoreOutsideClickUntil = Date.now() + 300;
    this.chatMode.set(true);
  }

  private closeChat(): void {
    if (this.chat.sending() || this.chat.listening()) return;
    this.ignoreOutsideClickUntil = Date.now() + 300;
    this.chatMode.set(false);
    // Keep composer draft — only blur so slot prefills survive an outside click.
    this.searchInput()?.nativeElement?.blur();
  }

  toggleMute(): void {
    this.isMuted.update((muted) => !muted);
    const video = this.heroVideo()?.nativeElement;
    if (video) {
      video.muted = this.isMuted();
      if (!video.muted) {
        void video.play().catch(() => undefined);
      }
    }
  }
}
