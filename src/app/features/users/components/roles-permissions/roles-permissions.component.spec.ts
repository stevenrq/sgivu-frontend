import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolesPermissionsComponent } from './roles-permissions.component';

describe('RolesPermissionsComponent', () => {
  let component: RolesPermissionsComponent;
  let fixture: ComponentFixture<RolesPermissionsComponent>;

  beforeEach(async () => {
    (globalThis as any).bootstrap = {
      Modal: class {
        constructor() {}
        show() {}
        hide() {}
      },
    };
    await TestBed.configureTestingModule({
      imports: [RolesPermissionsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RolesPermissionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
