import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AboutTimelineComponent } from './about-timeline.component';
import { TranslatePipe } from '@ngx-translate/core';

describe('AboutTimelineComponent', () => {
  let component: AboutTimelineComponent;
  let fixture: ComponentFixture<AboutTimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutTimelineComponent, TranslatePipe.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(AboutTimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with activeIdx 3', () => {
    expect(component.activeIdx()).toBe(3);
    expect(component.activePercent).toBe(100);
  });

  it('should update activeIdx on setActive', () => {
    component.setActive(0);
    expect(component.activeIdx()).toBe(0);
    expect(component.activePercent).toBe(0);
  });

  it('should handle keyboard navigation focusAdjacent arrowRight', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    spyOn(event, 'preventDefault');
    component.focusAdjacent(3, 1, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.activeIdx()).toBe(0); // wrap around
  });

  it('should handle keyboard navigation focusAdjacent arrowLeft', () => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
    spyOn(event, 'preventDefault');
    component.focusAdjacent(0, -1, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.activeIdx()).toBe(3); // wrap around
  });
});
