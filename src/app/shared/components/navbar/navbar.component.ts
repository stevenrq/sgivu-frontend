import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../features/auth/services/auth.service';
import { UserService } from '../../../features/users/services/user.service';
import { User } from '../../models/user.model';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, AsyncPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  protected user$!: Observable<User | null>;

  protected isAuthenticated$: Observable<boolean>;

  constructor(
    readonly authService: AuthService,
    private readonly userService: UserService,
  ) {
    this.isAuthenticated$ = this.authService.isReadyAndAuthenticated$;
  }

  ngOnInit(): void {
    this.user$ = this.authService.currentAuthenticatedUser$.pipe(
      switchMap((authenticatedUser) => {
        if (authenticatedUser?.id) {
          return this.userService.getById(authenticatedUser.id);
        }
        return of(null);
      }),
    );
  }

  login() {
    this.authService.startLoginFlow();
  }

  logout(): void {
    this.authService.logout();
  }
}
