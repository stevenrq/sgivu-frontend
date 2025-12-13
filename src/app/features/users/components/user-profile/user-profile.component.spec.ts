import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { UserProfileComponent } from './user-profile.component';
import { AuthService } from '../../../auth/services/auth.service';
import { UserService } from '../../services/user.service';
import { PermissionService } from '../../../auth/services/permission.service';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
          },
        },
        { provide: AuthService, useValue: { currentAuthenticatedUser$: of(null) } },
        { provide: UserService, useValue: { getById: () => of(null) } },
        {
          provide: PermissionService,
          useValue: {
            getUserPermissions: () => of(new Set<string>()),
          },
        },
        { provide: UserUiHelperService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
