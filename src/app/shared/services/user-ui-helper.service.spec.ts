import { TestBed } from '@angular/core/testing';

import { UserUiHelperService } from './user-ui-helper.service';

describe('UserUiHelperService', () => {
  let service: UserUiHelperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserUiHelperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
