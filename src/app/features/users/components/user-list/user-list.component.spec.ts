import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { UserListComponent } from './user-list.component';
import { UserService } from '../../services/user.service';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';
import { PermissionService } from '../../../auth/services/permission.service';

describe('UserListComponent', () => {
  let component: UserListComponent;
  let fixture: ComponentFixture<UserListComponent>;
  const userServiceStub = {
    getAllPaginated: jasmine.createSpy('getAllPaginated').and.returnValue(
      of({ content: [], totalElements: 0, number: 0 } as any),
    ),
    getUserCount: jasmine
      .createSpy('getUserCount')
      .and.returnValue(of({ active: 0, inactive: 0, total: 0 })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserListComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: UserService, useValue: userServiceStub },
        { provide: UserUiHelperService, useValue: { updateStatus: () => {} } },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: () => of(true),
            hasAnyPermission: () => of(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
