import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ItineraryService } from '../shared/services/itinerary.service';
import { AdminAuthService } from '../shared/services/admin-auth.service';
import { SkeletonComponent, EmptyStateComponent, ToastService, ConfirmDialogService } from 'ui';
import { exportToCsv } from '../shared/utils/export-csv';
import { environment } from '../../environments/environment';

import { Observable, Subject, Subscription, forkJoin, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';

@Component({
    selector: 'app-itinerary',
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule,
        SkeletonComponent, EmptyStateComponent],
    templateUrl: './itinerary.component.html'
})
export class ItineraryComponent implements OnInit, OnDestroy {
  private itineraryService = inject(ItineraryService);
  authService = inject(AdminAuthService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private fb = inject(FormBuilder);

  summaryCards$!: Observable<any[]>;
  itineraryList$!: Observable<any[]>;

  selectedItinerary: any = null;
  isLoading = true;

  showEditModal = false;
  showCreateModal = false;
  editDraft: any = {};

  showGodModeModal = false;
  godModeItinerary: any = null;
  private http = inject(HttpClient);

  // ReactiveForms
  createForm = this.fb.group({
    customer_id: [''],
    customer_name: ['', [Validators.required, Validators.minLength(2)]],
    destination: ['', [Validators.required]],
    travelers: [2, [Validators.required, Validators.min(1)]],
    budget: [''],
  });

  editForm = this.fb.group({
    title: ['', [Validators.required]],
    destination: ['', [Validators.required]],
    status: ['Created'],
  });

  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  readonly pageSize = 20;
  selectedStatus = '';
  selectedSort = '-created_at';
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
    this.summaryCards$ = this.itineraryService.getStats();
    this.itineraryList$ = this.itineraryService.list({
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

  bulkDelete() {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) return;
    const ref = this.confirmDialog.confirm({
      data: { title: 'Delete Itineraries', message: `Are you sure you want to delete ${ids.length} selected itinerary/itineraries? This action cannot be undone.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      forkJoin(ids.map(id => this.itineraryService.delete(id).pipe(catchError(() => of(null)))))
        .subscribe(results => {
          const failed = results.filter(r => r === null).length;
          this.toast.show(failed ? `${failed} deletions failed` : 'Selected itineraries deleted', 'error', 3000);
          this.loadData();
        });
    });
  }

  openItineraryDetails(it: any) {
    this.itineraryService.getById(it.id).subscribe({
      next: (full) => { this.selectedItinerary = full; },
      error: () => this.toast.error('Failed to load itinerary details', 3000)
    });
  }

  closeItineraryDetails() { this.selectedItinerary = null; }

  openGodMode(it: any) {
    this.godModeItinerary = it;
    this.showGodModeModal = true;
  }

  closeGodMode() {
    this.showGodModeModal = false;
    this.godModeItinerary = null;
  }

  issueRefund() {
    if (!this.godModeItinerary) return;

    const paymentIntentId =
      this.godModeItinerary.payment_intent_id ||
      this.godModeItinerary.paymentIntentId ||
      this.godModeItinerary.stripe_payment_intent_id;

    if (!paymentIntentId) {
      this.toast.error('No payment intent on this itinerary — cannot refund.', 3000);
      return;
    }

    this.http
      .post(`${environment.apiBaseUrl}/checkout/refund`, { payment_intent_id: paymentIntentId })
      .subscribe({
        next: () => {
          this.toast.success('Refund issued successfully via Stripe', 3000);
          this.closeGodMode();
        },
        error: () => this.toast.error('Failed to issue refund. Check Stripe logs.', 3000),
      });
  }

  openCreateModal() {
    this.createForm.reset({ customer_id: '', customer_name: '', destination: '', travelers: 2, budget: '' });
    this.showCreateModal = true;
  }

  closeCreateModal() { this.showCreateModal = false; }

  saveNewItinerary() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.itineraryService.create(this.createForm.value).subscribe({
      next: () => {
        this.toast.success('Itinerary created successfully', 3000);
        this.closeCreateModal();
        this.loadData();
      },
      error: () => this.toast.error('Failed to create itinerary', 3000)
    });
  }

  openEditModal(it: any) {
    this.editDraft = { ...it };
    this.editForm.reset({ title: it.displayCode, destination: it.destination, status: it.status });
    this.showEditModal = true;
  }

  closeEditModal() { this.showEditModal = false; }

  saveEditItinerary() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const updateBody = this.editForm.value;
    this.itineraryService.update(this.editDraft.id, updateBody).subscribe({
      next: () => {
        this.toast.success('Itinerary updated', 3000);
        this.closeEditModal();
        if (this.selectedItinerary?.id === this.editDraft.id) this.selectedItinerary = { ...this.selectedItinerary, ...this.editForm.value };
        this.loadData();
      },
      error: () => this.toast.error('Failed to update itinerary', 3000)
    });
  }

  deleteItinerary(id: string) {
    const ref = this.confirmDialog.confirm({
      data: { title: 'Delete Itinerary', message: 'Are you sure you want to delete this itinerary? This cannot be undone.', confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.itineraryService.delete(id).subscribe({
        next: () => {
          this.toast.success('Itinerary deleted', 3000);
          if (this.selectedItinerary?.id === id) this.closeItineraryDetails();
          this.loadData();
        },
        error: () => this.toast.error('Failed to delete itinerary', 3000)
      });
    });
  }

  exportCsv() {
    exportToCsv('itineraries.csv', this.currentList, ['displayCode', 'customerName', 'destination', 'duration', 'type', 'status']);
  }

  get createCustomerName() { return this.createForm.get('customer_name')!; }
  get createDestination() { return this.createForm.get('destination')!; }
}
