import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AppHeaderComponent } from '../../../shared/components/app-header/app-header.component';
import { SearchBarComponent } from '../../../shared/components/search-bar/search-bar.component';
import { SidebarNavComponent } from '../../../shared/components/sidebar-nav/sidebar-nav.component';
import { AiAssistantPanelComponent } from '../../../shared/components/ai-assistant-panel/ai-assistant-panel.component';
import { ComingSoonComponent } from '../../../shared/components/coming-soon/coming-soon.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';
import { HomeTabComponent } from './home-tab/home-tab.component';
import { DiscoverTabComponent } from './discover-tab/discover-tab.component';
import { CommunityTravelCirclesComponent } from '../../community-travelcircles/components/community-travelcircles-page.component';
import { CommunityTripsComponent } from '../../community-trips/components/community-trips-page.component';
import { SavedTabComponent } from './saved-tab/saved-tab.component';
import { ModalShellComponent } from './overlays/modal-shell/modal-shell.component';
import { ComposerTypeMenuComponent } from './overlays/composer-type-menu/composer-type-menu.component';
import { ComposerFormComponent } from './overlays/composer-form/composer-form.component';
import { AddToTripModalComponent } from './overlays/add-to-trip-modal/add-to-trip-modal.component';
import { StoryViewerModalComponent } from './overlays/story-viewer-modal/story-viewer-modal.component';
import { PostOptionsModalComponent } from './overlays/post-options-modal/post-options-modal.component';
import { CommunityHomeStore } from '../store/community-home.store';
import { AI_PROMPTS, SEARCH_SUGGESTIONS } from '../../../core/data/community-mock-data';
import { AiPrompt, CommunityTab, ProfileMenuItem, SearchSuggestion, SideCircle } from '../../../core/models/community.models';

@Component({
  selector: 'app-community-home-page',
  imports: [
    AppHeaderComponent,
    SearchBarComponent,
    SidebarNavComponent,
    AiAssistantPanelComponent,
    ComingSoonComponent,
    ToastComponent,
    HomeTabComponent,
    DiscoverTabComponent,
    CommunityTravelCirclesComponent,
    CommunityTripsComponent,
    SavedTabComponent,
    ModalShellComponent,
    ComposerTypeMenuComponent,
    ComposerFormComponent,
    AddToTripModalComponent,
    StoryViewerModalComponent,
    PostOptionsModalComponent,
  ],
  templateUrl: './community-home-page.component.html',
  styleUrl: './community-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityHomePageComponent {
  readonly store = inject(CommunityHomeStore);

  readonly searchSuggestions = SEARCH_SUGGESTIONS;
  readonly aiPrompts = AI_PROMPTS;

  readonly auroraX = signal(50);
  readonly auroraY = signal(35);

  onAmbientMouseMove(event: MouseEvent): void {
    this.auroraX.set((event.clientX / window.innerWidth) * 100);
    this.auroraY.set((event.clientY / window.innerHeight) * 100);
  }

  onSelectSuggestion(suggestion: SearchSuggestion): void {
    this.store.selectTab(suggestion.target);
  }

  onProfileMenuItem(item: ProfileMenuItem): void {
    if (item.target) {
      this.store.selectTab(item.target);
    } else {
      this.store.showToast(item.label);
    }
  }

  onSelectCircle(circle: SideCircle): void {
    this.store.showToast(`Opening ${circle.name}`);
    this.store.selectTab('Travel Circles');
  }

  onAiPrompt(prompt: AiPrompt): void {
    this.store.closeAiPanel();
    this.store.selectTab(prompt.target);
  }

  onAiAsk(question: string): void {
    this.store.closeAiPanel();
    this.store.showToast(`Asking TRAVL AI: ${question}`);
  }

  goHome(): void {
    this.store.selectTab('Home' as CommunityTab);
  }
}
