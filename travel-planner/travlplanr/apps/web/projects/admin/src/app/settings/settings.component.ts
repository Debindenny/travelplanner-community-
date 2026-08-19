import { Component, inject, OnInit } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from 'ui';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
    selector: 'app-settings',
    imports: [ReactiveFormsModule],
    templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  public authService = inject(AdminAuthService);
  private http = inject(HttpClient);

  profileForm = this.fb.group({
    name: [this.authService.currentUser()?.name || '', [Validators.required]],
    email: [this.authService.currentUser()?.email || '', [Validators.required, Validators.email]],
    phone: ['+1 (555) 000-0000'],
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required]
  });

  systemForm = this.fb.group({
    maintenanceMode: [false],
    registrationEnabled: [true],
    autoBackup: [true],
    timezone: ['UTC']
  });

  markupForm = this.fb.group({
    b2b_markup: [1.10, Validators.required],
    b2c_markup: [1.00, Validators.required]
  });

  ngOnInit() {
    this.http.get<{b2b_markup: number, b2c_markup: number}>(`${environment.apiBaseUrl}/checkout/markup`, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` }
    }).subscribe({
      next: (res) => {
        this.markupForm.patchValue(res);
      },
      error: () => {
        console.error('Failed to load markup config');
      }
    });
  }

  saveMarkup() {
    if (this.markupForm.valid) {
      this.http.post(`${environment.apiBaseUrl}/checkout/markup`, this.markupForm.value, {
        headers: { Authorization: `Bearer ${this.authService.getToken()}` }
      }).subscribe({
        next: () => {
          this.toast.success('Pricing Markup rules updated', 3000);
        },
        error: () => {
          this.toast.error('Failed to update markups', 3000);
        }
      });
    }
  }

  saveProfile() {
    if (this.profileForm.valid) {
      this.toast.error('Profile updates are not available yet — no staff profile API is wired.', 4000);
    }
  }

  changePassword() {
    if (this.passwordForm.valid) {
      if (this.passwordForm.value.newPassword !== this.passwordForm.value.confirmPassword) {
        this.toast.error('Passwords do not match', 3000);
        return;
      }
      this.toast.error('Password changes are not available yet — no staff password API is wired.', 4000);
    }
  }

  saveSystem() {
    this.toast.error('System preferences are not available yet — no settings API is wired.', 4000);
  }
}

