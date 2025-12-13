import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { UserFormComponent } from './user-form.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;
  const userServiceStub = {
    getById: jasmine.createSpy('getById').and.returnValue(of(null)),
    create: jasmine.createSpy('create').and.returnValue(of({})),
    update: jasmine.createSpy('update').and.returnValue(of({})),
  };
  const authServiceStub = {
    getUserId: jasmine.createSpy('getUserId').and.returnValue(null),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserFormComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: UserService, useValue: userServiceStub },
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
