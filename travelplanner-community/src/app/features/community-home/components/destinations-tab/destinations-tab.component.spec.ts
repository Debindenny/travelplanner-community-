import { TestBed } from '@angular/core/testing';

import { DestinationsTabComponent } from './destinations-tab.component';
import { CommunityHomeStore } from '../../store/community-home.store';

describe('DestinationsTabComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinationsTabComponent],
    }).compileComponents();
  });

  it('renders a card for every destination', () => {
    const fixture = TestBed.createComponent(DestinationsTabComponent);
    fixture.detectChanges();

    const store = TestBed.inject(CommunityHomeStore);
    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-destination-card');

    expect(cards.length).toBe(store.destinations().length);
    expect(el.textContent).toContain('Paris, France');
    expect(el.textContent).toContain('Tokyo, Japan');
  });

  it('toggles the active sort pill and updates the store', () => {
    const fixture = TestBed.createComponent(DestinationsTabComponent);
    fixture.detectChanges();

    const store = TestBed.inject(CommunityHomeStore);
    const el = fixture.nativeElement as HTMLElement;
    const nearMePill = Array.from(el.querySelectorAll('.pill')).find(
      (btn) => btn.textContent?.trim() === 'Near me',
    ) as HTMLButtonElement;

    expect(nearMePill.classList.contains('is-active')).toBe(false);
    nearMePill.click();
    fixture.detectChanges();

    expect(nearMePill.classList.contains('is-active')).toBe(true);
    expect(store.destinationSort()).toBe('Near me');
  });

  it('joins a destination and shows a toast', () => {
    const fixture = TestBed.createComponent(DestinationsTabComponent);
    fixture.detectChanges();

    const store = TestBed.inject(CommunityHomeStore);
    const el = fixture.nativeElement as HTMLElement;
    const firstCard = el.querySelector('app-destination-card') as HTMLElement;
    const joinButton = firstCard.querySelector('.destination-card__join') as HTMLButtonElement;

    expect(joinButton.textContent?.trim()).toBe('Join');
    joinButton.click();
    fixture.detectChanges();

    expect(joinButton.textContent?.trim()).toBe('Joined');
    expect(store.joinedIds().has('ds1')).toBe(true);
    expect(store.toast()).toBe('You’re going to Paris, France');
  });
});
