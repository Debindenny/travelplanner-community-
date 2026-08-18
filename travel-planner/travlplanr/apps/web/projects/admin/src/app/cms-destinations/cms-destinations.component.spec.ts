import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmsDestinationsComponent } from './cms-destinations.component';

describe('CmsDestinationsComponent', () => {
  let component: CmsDestinationsComponent;
  let fixture: ComponentFixture<CmsDestinationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmsDestinationsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CmsDestinationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
