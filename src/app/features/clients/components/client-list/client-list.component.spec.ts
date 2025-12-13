import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientListComponent } from './client-list.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../auth/services/permission.service';
import { PersonService } from '../../services/person.service';
import { CompanyService } from '../../services/company.service';
import { ClientUiHelperService } from '../../../../shared/services/client-ui-helper.service';

describe('ClientListComponent', () => {
  let component: ClientListComponent;
  let fixture: ComponentFixture<ClientListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientListComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ page: '0' })),
            data: of({ clientType: 'person' }),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            hasPermission: () => of(true),
            hasAnyPermission: () => of(true),
          },
        },
        {
          provide: PersonService,
          useValue: {
            getAllPaginated: () =>
              of({ content: [], totalElements: 0, number: 0 } as any),
            getPersonCount: () =>
              of({ active: 0, inactive: 0, total: 0 } as any),
            searchPaginated: () =>
              of({ content: [], totalElements: 0, number: 0 } as any),
          },
        },
        {
          provide: CompanyService,
          useValue: {
            getAllPaginated: () =>
              of({ content: [], totalElements: 0, number: 0 } as any),
            getCompanyCount: () =>
              of({ active: 0, inactive: 0, total: 0 } as any),
            searchPaginated: () =>
              of({ content: [], totalElements: 0, number: 0 } as any),
          },
        },
        { provide: ClientUiHelperService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
