import { Component, Input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { ABOUT_TEAM } from '../../../shared/data/about.data';

@Component({
    selector: 'app-about-team-section',
    imports: [TranslatePipe],
    template: `
    <section 
      id="team"
      class="section-container bg-surface-muted py-20 border-t border-b border-border-light/40 transition-all duration-700 ease-out"
      [class.opacity-100]="isVisible"
      [class.translate-y-0]="isVisible"
      [class.opacity-0]="!isVisible"
      [class.translate-y-12]="!isVisible"
    >
      <div class="mx-auto max-w-content">
        <div class="text-center">
          <h2 class="text-4xl font-bold tracking-tight text-text-primary">{{ 'ABOUT.TEAM.BUILD_TITLE' | translate }}</h2>
          <p class="mt-2 text-base text-text-secondary">{{ 'ABOUT.TEAM.BUILD_SUBTITLE' | translate }}</p>
        </div>

        <div class="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 max-w-[800px] mx-auto">
          @for (member of team; track member.id) {
            <article class="group relative rounded-card border border-border-light/60 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-card-hover flex flex-col items-center text-center">
              <div [class]="member.colorClass + ' flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold shadow-md transition-transform duration-300 group-hover:scale-105'">
                {{ member.initials }}
              </div>
              
              <h3 class="mt-6 text-xl font-bold text-text-primary">{{ 'ABOUT.TEAM.' + member.id + '.NAME' | translate }}</h3>
              <span class="text-sm font-semibold text-primary uppercase tracking-wider">{{ 'ABOUT.TEAM.' + member.id + '.ROLE' | translate }}</span>

              <p class="mt-4 text-sm-plus leading-relaxed text-text-secondary">
                {{ 'ABOUT.TEAM.' + member.id + '.BIO' | translate }}
              </p>

              <div class="mt-6 w-full border-t border-border-light/50 pt-4 flex items-center justify-center gap-2">
                <span class="text-xs font-bold text-text-primary">{{ 'ABOUT.TEAM.FOCUS_AREA_LABEL' | translate }}</span>
                <span class="text-xs font-semibold text-primary bg-primary-50 px-2.5 py-1 rounded-full border border-primary/10">
                  📍 {{ 'ABOUT.TEAM.' + member.id + '.FOCUS' | translate }}
                </span>
              </div>
            </article>
          }
        </div>
      </div>
    </section>
  `
})
export class AboutTeamSectionComponent {
  @Input() isVisible = false;
  readonly team = ABOUT_TEAM;
}
