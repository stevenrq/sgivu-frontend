import { Injectable, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Role } from '../../../shared/models/role.model';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly apiUrl = `${environment.apiUrl}/v1/roles`;
  private readonly rolesState: WritableSignal<Set<Role>> = signal<Set<Role>>(
    new Set<Role>(),
  );

  constructor(private readonly http: HttpClient) {}

  public addPermissions(roleId: number, permissions: string[]) {
    return this.http.post<Role>(
      `${this.apiUrl}/${roleId}/add-permissions`,
      permissions,
    );
  }

  public findAll() {
    return this.http.get<Set<Role>>(this.apiUrl);
  }

  public updatePermissions(roleId: number, permissions: string[]) {
    return this.http.put<Role>(
      `${this.apiUrl}/${roleId}/permissions`,
      permissions,
    );
  }

  public removePermissions(roleId: number, permissions: string[]) {
    return this.http.delete<Role>(
      `${this.apiUrl}/${roleId}/remove-permissions`,
      { body: permissions },
    );
  }
}
