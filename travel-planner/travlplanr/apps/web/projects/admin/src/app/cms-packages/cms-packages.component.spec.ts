import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmsPackagesComponent } from './cms-packages.component';

describe('CmsPackagesComponent', () => {
  let component: CmsPackagesComponent;
  let fixture: ComponentFixture<CmsPackagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmsPackagesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CmsPackagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
