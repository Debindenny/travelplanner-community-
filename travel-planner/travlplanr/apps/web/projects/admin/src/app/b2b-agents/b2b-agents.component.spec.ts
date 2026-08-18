import { ComponentFixture, TestBed } from '@angular/core/testing';

import { B2bAgentsComponent } from './b2b-agents.component';

describe('B2bAgentsComponent', () => {
  let component: B2bAgentsComponent;
  let fixture: ComponentFixture<B2bAgentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [B2bAgentsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(B2bAgentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
