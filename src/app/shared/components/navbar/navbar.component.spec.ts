import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../../features/auth/services/auth.service';
import { UserService } from '../../../features/users/services/user.service';
import { ThemeService } from '../../services/theme.service';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  const authStub = {
    isReadyAndAuthenticated$: of(false),
    currentAuthenticatedUser$: of(null),
    startLoginFlow: jasmine.createSpy('startLoginFlow'),
    logout: jasmine.createSpy('logout'),
  };
  const userServiceStub = {
    getById: jasmine.createSpy('getById').and.returnValue(of(null)),
  };
  const themeServiceStub = {
    activeTheme$: of('light'),
    toggleTheme: jasmine.createSpy('toggleTheme'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: UserService, useValue: userServiceStub },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
