import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SettingsComponent } from './settings.component';
import { AuthService } from '../../../features/auth/services/auth.service';
import { ThemeService } from '../../services/theme.service';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  const authStub = {
    currentAuthenticatedUser$: of(null),
  };
  const themeStub = {
    preference$: of('system'),
    currentPreference: 'system',
    setPreference: jasmine.createSpy('setPreference'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: ThemeService, useValue: themeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
