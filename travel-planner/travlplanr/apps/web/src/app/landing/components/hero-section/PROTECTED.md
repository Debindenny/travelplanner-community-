# Protected surface — hero-section.component.ts

This component's `.hero-viewport` subtree is covered by an automated visual +
functional guardrail (`apps/web/e2e/hero-guardrail.spec.ts`). The following
must not change without updating that spec and regenerating its baseline
screenshot (see the spec's header comment for the exact command):

- The background `<video>` element: its static source
  (`assets/videos/website_header.mp4`), the `[muted]="isMuted()"` binding,
  and its position as the first element inside `.hero-viewport`.
- The mute toggle button (`.hero-mute-btn`) and its `toggleMute()` handler.
- The chat/search composer form (`.hero-search`, `(submit)="onSubmit($event)"`)
  and its text input.
- The send/stop button (`.search-btn`), including its dual role via
  `onSubmit($event)` / `onStopGenerating($event)`.
- The destination suggestion chips (`<app-destination-typeahead
  presentation="chips" (picked)="onTypeaheadPicked($event)">`) and the
  services it depends on: `TravelChatSessionService`, `ChatContextService`,
  `DestinationSearchService` (all in `apps/web/src/app/shared/services/`).

Any change to markup, class names, or handler wiring for these elements
requires:

1. Updating `apps/web/e2e/hero-guardrail.spec.ts` selectors/assertions to match.
2. Regenerating the pixel baseline with `--update-snapshots` and reviewing the
   diff intentionally (not just accepting it).
3. Calling out the change explicitly in the PR description.

Everything else in this component (copy, layout below the fold, chat-thread
rendering, docking/scroll animation behavior, i18n keys) is not covered by
this guardrail and may change freely.
