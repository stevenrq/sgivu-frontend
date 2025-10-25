import { Component, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { User } from '../../../../shared/models/user.model';
import { PaginatedResponse } from '../../../../shared/models/paginated-response';
import { PagerComponent } from '../../../pager/components/pager/pager.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  forkJoin,
  Subscription,
} from 'rxjs';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule } from '@angular/forms';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { UserUiHelperService } from '../../../../shared/services/user-ui-helper.service';

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    PagerComponent,
    RouterLink,
    HasPermissionDirective,
    FormsModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit, OnDestroy {
  private routeSubscription: Subscription | undefined;
  users: User[] = [];
  pager: PaginatedResponse<User> | undefined;
  readonly url: string = '/users/page';
  totalUsers: number = 0;
  activeUsers: number = 0;
  inactiveUsers: number = 0;
  searchTerm: string = '';
  error: string | null = null;
  searchControl = new FormControl<string>('');
  isLoading: boolean = false;

  constructor(
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly userUiHelper: UserUiHelperService,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const pageParam = params.get('page');
      const parsedPage = Number(pageParam);
      this.loadUsers(Number.isNaN(parsedPage) ? 0 : parsedPage);
    });

    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        filter((term): term is string => term !== null),
        distinctUntilChanged(),
        tap(() => {
          this.isLoading = true;
        }),
        switchMap((term: string) => {
          this.error = null;

          if (!term.trim()) {
            return this.userService.getAll();
          }

          return this.userService.searchUsersByName(term);
        }),
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.isLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.error = 'Error al cargar usuarios';
          this.isLoading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private loadUsers(page: number): void {
    this.isLoading = true;

    forkJoin({
      userCount: this.userService.getUserCount(),
      pager: this.userService.getAllPaginated(page),
    })
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: ({ userCount, pager }) => {
          this.activeUsers = userCount.activeUsers;
          this.inactiveUsers = userCount.inactiveUsers;
          this.totalUsers = pager.totalElements ?? 0;
          this.users = pager.content;
          this.pager = pager;
        },
        error: (err) => {
          console.error(err);
          this.error = 'Error al cargar usuarios';
          this.users = [];
          this.pager = undefined;
        },
      });
  }

  protected search(): void {
    const trimmedTerm = this.searchTerm.trim();
    this.isLoading = true;

    const request$ = trimmedTerm
      ? this.userService.searchUsersByName(trimmedTerm)
      : this.userService.getAll();

    request$
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
      )
      .subscribe({
        next: (users) => {
          this.error = null;
          this.users = users;
        },
        error: (err) => {
          console.error(err);
          this.error = 'Error al buscar usuarios.';
        },
      });
  }

  public updateStatus(id: number, status: boolean): void {
    const currentPage = this.pager?.number ?? 0;
    this.userUiHelper.updateStatus(id, status, () =>
      this.loadUsers(currentPage),
    );
  }
}
