import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RejoiningForm } from './rejoining-form';

describe('RejoiningForm', () => {
  let component: RejoiningForm;
  let fixture: ComponentFixture<RejoiningForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RejoiningForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RejoiningForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
