import { Component, inject } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { ApiError } from '../core/error.interceptor';

@Component({
    selector: 'app-login',
    imports: [RouterLink, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private router = inject(Router);
  private authService = inject(AdminAuthService);

  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin(event: Event) {
    event.preventDefault();
    this.errorMessage = '';
    
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: ApiError) => {
        this.isLoading = false;
        console.error('Login failed', err);
        if (err.status === 0 || err.status === 502 || err.status === 503) {
          this.errorMessage = 'Cannot reach the auth service. Make sure Docker gateway (port 8080) and identity are running.';
        } else if (err.status === 401) {
          this.errorMessage = err.message || 'Invalid email or password. Dev default: admin@travlplanr.com / password';
        } else {
          this.errorMessage = err.message || 'Login failed. Please try again.';
        }
      }
    });
  }
}
