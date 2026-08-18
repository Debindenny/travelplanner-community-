import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { StaffService } from '../shared/services/staff.service';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { SkeletonComponent, EmptyStateComponent, ToastService, ConfirmDialogService } from 'ui';
import { exportToCsv } from '../shared/utils/export-csv';

import { Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';

@Component({
    selector: 'app-staff',
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule,
        SkeletonComponent, EmptyStateComponent],
    templateUrl: './staff.component.html'
})
export class StaffComponent implements OnInit, OnDestroy {
  private staffService = inject(StaffService);
  authService = inject(AdminAuthService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  summaryCards$!: Observable<any[]>;
  staffList$!: Observable<any[]>;

  selectedStaff: any = null;
  isLoading = true;

  showEditModal = false;
  showCreateModal = false;
  editDraft: any = {};

  // ReactiveForm for create
  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['Staff'],
  });

  // ReactiveForm for edit
  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    role: ['Staff'],
  });

  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  readonly pageSize = 20;
  selectedStatus = '';
  selectedSort = '-date_joined';
  selectedIds = new Set<string>();
  currentList: any[] = [];

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  searchQuery = '';

  ngOnInit() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery = val;
      this.currentPage = 1;
      this.loadData();
    });
    this.loadData();
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
  }

  loadData() {
    this.isLoading = true;
    this.summaryCards$ = this.staffService.getStats();
    this.staffList$ = this.staffService.list({
      page: this.currentPage,
      q: this.searchQuery,
      pageSize: this.pageSize,
      status: this.selectedStatus || undefined,
      sort: this.selectedSort,
    }).pipe(
      map(res => {
        this.totalPages = res.totalPages || 1;
        this.totalRecords = res.total || 0;
        this.selectedIds.clear();
        this.currentList = res.items;
        this.isLoading = false;
        return res.items;
      }),
      catchError(() => { this.isLoading = false; return of([]); })
    );
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadData();
    }
  }

  onSearch(event: Event) {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  onStatusChange(value: string) {
    this.selectedStatus = value;
    this.currentPage = 1;
    this.loadData();
  }

  onSortChange(value: string) {
    this.selectedSort = value;
    this.currentPage = 1;
    this.loadData();
  }

  get rangeLabel(): string {
    if (this.totalRecords === 0) return 'No results';
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalRecords);
    return `${start}–${end} of ${this.totalRecords}`;
  }

  isSelected(id: string): boolean { return this.selectedIds.has(id); }

  toggleSelect(id: string, event: Event) {
    (event.target as HTMLInputElement).checked ? this.selectedIds.add(id) : this.selectedIds.delete(id);
  }

  allSelected(list: any[]): boolean {
    return list.length > 0 && list.every(s => this.selectedIds.has(s.id));
  }

  toggleSelectAll(list: any[], event: Event) {
    this.selectedIds.clear();
    if ((event.target as HTMLInputElement).checked) list.forEach(s => this.selectedIds.add(s.id));
  }

  openCreateModal() {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can add staff', 3000);
      return;
    }
    this.createForm.reset({ name: '', email: '', phone: '', role: 'Staff' });
    this.showCreateModal = true;
  }

  closeCreateModal() { this.showCreateModal = false; }

  saveNewStaff() {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can add staff', 3000);
      return;
    }
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.staffService.create(this.createForm.value).subscribe({
      next: () => {
        this.toast.success('Staff member added successfully', 3000);
        this.closeCreateModal();
        this.loadData();
      },
      error: (err) => {
        const msg = err?.status === 403
          ? 'Only Managers and Admins can add staff'
          : 'Failed to add staff';
        this.toast.error(msg, 3000);
      }
    });
  }

  openEditModal(staff: any) {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can edit staff', 3000);
      return;
    }
    this.editDraft = { ...staff };
    this.editForm.reset({ name: staff.name, phone: staff.phone, role: staff.role });
    this.showEditModal = true;
  }

  closeEditModal() { this.showEditModal = false; }

  saveEditStaff() {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can edit staff', 3000);
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const updateBody = { name: this.editForm.value.name, phone: this.editForm.value.phone, role: this.editForm.value.role };
    this.staffService.update(this.editDraft.id, updateBody).subscribe({
      next: () => {
        this.toast.success('Staff updated', 3000);
        this.closeEditModal();
        if (this.selectedStaff?.id === this.editDraft.id) this.selectedStaff = { ...this.selectedStaff, ...this.editForm.value };
        this.loadData();
      },
      error: (err) => {
        const msg = err?.status === 403
          ? 'Only Managers and Admins can edit staff'
          : 'Failed to update staff';
        this.toast.error(msg, 3000);
      }
    });
  }

  deleteStaff(id: string) {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can remove staff', 3000);
      return;
    }
    const ref = this.confirmDialog.confirm({
      data: { title: 'Remove Staff', message: 'Are you sure? This will revoke their access to the admin panel.', confirmLabel: 'Remove', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.staffService.delete(id).subscribe({
        next: () => {
          this.toast.success('Staff removed', 3000);
          if (this.selectedStaff?.id === id) this.closeStaffDetails();
          this.loadData();
        },
        error: (err) => {
          const msg = err?.status === 403
            ? 'Only Managers and Admins can remove staff'
            : 'Failed to remove staff';
          this.toast.error(msg, 3000);
        }
      });
    });
  }

  bulkDelete() {
    if (!this.authService.canManageStaff()) {
      this.toast.error('Only Managers and Admins can remove staff', 3000);
      return;
    }
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;
    const ref = this.confirmDialog.confirm({
      data: { title: 'Remove Staff', message: `Remove ${ids.length} selected staff member(s)? Their access will be revoked.`, confirmLabel: 'Remove', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      forkJoin(ids.map(id => this.staffService.delete(id).pipe(catchError(() => of(null)))))
        .subscribe(results => {
          const failed = results.filter(r => r === null).length;
          this.toast.show(failed ? `${failed} removals failed` : 'Selected staff removed', failed ? 'error' : 'success', 3000);
          this.loadData();
        });
    });
  }

  openStaffDetails(staff: any) {
    this.staffService.getById(staff.id).subscribe({
      next: (full) => { this.selectedStaff = full; },
      error: () => this.toast.error('Failed to load staff details', 3000)
    });
  }

  closeStaffDetails() { this.selectedStaff = null; }

  exportCsv() {
    exportToCsv('staff.csv', this.currentList, ['displayCode', 'name', 'email', 'phone', 'role', 'dateJoined']);
  }

  get createName() { return this.createForm.get('name')!; }
  get createEmail() { return this.createForm.get('email')!; }
}
