import { TemplateRef, ViewContainerRef } from '@angular/core';
import { of } from 'rxjs';
import { PermissionService } from '../../features/auth/services/permission.service';
import { HasPermissionDirective } from './has-permission.directive';

describe('HasPermissionDirective', () => {
  it('should create an instance', () => {
    const templateRef = {} as TemplateRef<any>;
    const viewContainerRef = {
      createEmbeddedView: jasmine.createSpy('createEmbeddedView'),
      clear: jasmine.createSpy('clear'),
    } as unknown as ViewContainerRef;
    const permissionService = {
      hasPermission: () => of(true),
    } as unknown as PermissionService;

    const directive = new HasPermissionDirective(
      templateRef,
      viewContainerRef,
      permissionService,
    );
    expect(directive).toBeTruthy();
  });
});
