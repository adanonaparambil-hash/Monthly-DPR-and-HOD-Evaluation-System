import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthlyDprComponent } from './monthly-dpr.component';

describe('MonthlyDprComponent', () => {
  let component: MonthlyDprComponent;
  let fixture: ComponentFixture<MonthlyDprComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyDprComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonthlyDprComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
