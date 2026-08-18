import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CustomerService } from '../shared/services/customer.service';
import { CreateCustomerRequest } from '../shared/models/customer.model';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { SkeletonComponent, EmptyStateComponent, ToastService, ConfirmDialogService } from 'ui';
import { exportToCsv } from '../shared/utils/export-csv';

import { Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

@Component({
    selector: 'app-customer',
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule,
        SkeletonComponent, EmptyStateComponent],
    templateUrl: './customer.component.html'
})
export class CustomerComponent implements OnInit, OnDestroy {
  private customerService = inject(CustomerService);
  authService = inject(AdminAuthService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  summaryCards$!: Observable<any[]>;
  customerList$!: Observable<any[]>;

  selectedCustomer: any = null;
  isLoading = true;

  showEditModal = false;
  showCreateModal = false;
  editDraft: any = {};

  // ReactiveForm for create
  createForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    customer_type: ['Solo'],
  });

  // ReactiveForm for edit
  editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    type: ['Solo'],
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
    // Debounced search: wait 300ms after last keystroke
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
    this.summaryCards$ = this.customerService.getStats();
    this.customerList$ = this.customerService.list({
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
    return list.length > 0 && list.every(c => this.selectedIds.has(c.id));
  }

  toggleSelectAll(list: any[], event: Event) {
    this.selectedIds.clear();
    if ((event.target as HTMLInputElement).checked) list.forEach(c => this.selectedIds.add(c.id));
  }

  bulkDelete() {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;
    const ref = this.confirmDialog.confirm({
      data: { title: 'Delete Customers', message: `Delete ${ids.length} selected customer(s)? Their accounts will also be removed.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      forkJoin(ids.map(id => this.customerService.delete(id).pipe(catchError(() => of(null)))))
        .subscribe(results => {
          const failed = results.filter(r => r === null).length;
          this.toast.show(failed ? `${failed} deletions failed` : 'Selected customers deleted', 'error', 3000);
          this.loadData();
        });
    });
  }

  openCustomerDetails(customer: any) {
    this.customerService.getById(customer.id).subscribe({
      next: (full) => { this.selectedCustomer = full; },
      error: () => this.toast.error('Failed to load customer details', 3000)
    });
  }

  closeCustomerDetails() { this.selectedCustomer = null; }

  openCreateModal() {
    this.createForm.reset({ name: '', email: '', phone: '', customer_type: 'Solo' });
    this.showCreateModal = true;
  }

  closeCreateModal() { this.showCreateModal = false; }

  saveNewCustomer() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.customerService.create(this.createForm.getRawValue() as CreateCustomerRequest).subscribe({
      next: () => {
        this.toast.success('Customer created successfully', 3000);
        this.closeCreateModal();
        this.loadData();
      },
      error: () => this.toast.error('Failed to create customer', 3000)
    });
  }

  openEditModal(customer: any) {
    this.editDraft = { ...customer };
    this.editForm.reset({ name: customer.name, phone: customer.phone, type: customer.type });
    this.showEditModal = true;
  }

  closeEditModal() { this.showEditModal = false; }

  saveEditCustomer() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const updateBody = { name: this.editForm.value.name, phone: this.editForm.value.phone, customer_type: this.editForm.value.type };
    this.customerService.update(this.editDraft.id, updateBody).subscribe({
      next: () => {
        this.toast.success('Customer updated', 3000);
        this.closeEditModal();
        if (this.selectedCustomer?.id === this.editDraft.id) this.selectedCustomer = { ...this.selectedCustomer, ...this.editForm.value };
        this.loadData();
      },
      error: () => this.toast.error('Failed to update customer', 3000)
    });
  }

  deleteCustomer(id: string) {
    const ref = this.confirmDialog.confirm({
      data: { title: 'Delete Customer', message: 'Are you sure? This will also remove their user account.', confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.customerService.delete(id).subscribe({
        next: () => {
          this.toast.success('Customer deleted', 3000);
          if (this.selectedCustomer?.id === id) this.closeCustomerDetails();
          this.loadData();
        },
        error: () => this.toast.error('Failed to delete customer', 3000)
      });
    });
  }

  exportCsv() {
    exportToCsv('customers.csv', this.currentList, ['displayCode', 'name', 'email', 'phone', 'type', 'dateJoined']);
  }

  get createName() { return this.createForm.get('name')!; }
  get createEmail() { return this.createForm.get('email')!; }
}
