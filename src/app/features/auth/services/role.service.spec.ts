import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RoleService } from './role.service';
import { environment } from '../../../../environments/environment';

describe('RoleService', () => {
  let service: RoleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RoleService],
    });
    service = TestBed.inject(RoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('envía permisos a agregar con POST', () => {
    const permissions = ['user:create'];
    service.addPermissions(5, permissions).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/roles/5/add-permissions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(permissions);
    req.flush({ id: 5 });
  });

  it('recupera todos los roles', () => {
    service.findAll().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/roles`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('reemplaza permisos con PUT y elimina con DELETE usando body', () => {
    const permissions = ['user:delete'];

    service.updatePermissions(3, permissions).subscribe();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/v1/roles/3/permissions`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual(permissions);
    putReq.flush({ id: 3 });

    service.removePermissions(3, permissions).subscribe();
    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/v1/roles/3/remove-permissions`);
    expect(deleteReq.request.method).toBe('DELETE');
    expect(deleteReq.request.body).toEqual(permissions);
    deleteReq.flush({ id: 3 });
  });
});
