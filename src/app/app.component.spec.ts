import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

import { AppComponent } from './app.component';
import { AuthService } from './features/auth/services/auth.service';
import { UserService } from './features/users/services/user.service';
import { ThemeService } from './shared/services/theme.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: { isReadyAndAuthenticated$: of(false), currentAuthenticatedUser$: of(null), logout: () => {} } },
        { provide: UserService, useValue: { getById: () => of(null) } },
        { provide: ThemeService, useValue: { activeTheme$: of('light'), toggleTheme: () => {}, preference$: of('system'), currentPreference: 'system' } },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
