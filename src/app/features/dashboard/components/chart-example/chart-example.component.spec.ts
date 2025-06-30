import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChartExampleComponent } from './chart-example.component';

describe('ChartExampleComponent', () => {
  let component: ChartExampleComponent;
  let fixture: ComponentFixture<ChartExampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartExampleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChartExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
