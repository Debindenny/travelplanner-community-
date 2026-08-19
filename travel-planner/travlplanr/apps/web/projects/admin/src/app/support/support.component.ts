import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmsService, SupportTicket } from '../shared/services/cms.service';

@Component({
    selector: 'app-support',
    imports: [CommonModule, FormsModule],
    templateUrl: './support.component.html'
})
export class SupportComponent implements OnInit {
  private cmsService = inject(CmsService);
  
  tickets: SupportTicket[] = [];
  isLoading = true;
  statusFilter = '';
  
  selectedTicket: SupportTicket | null = null;
  showModal = false;

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.isLoading = true;
    this.cmsService.getTickets(this.statusFilter).subscribe({
      next: (data) => {
        this.tickets = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  onFilterChange() {
    this.loadTickets();
  }

  viewTicket(ticket: SupportTicket) {
    this.selectedTicket = ticket;
    this.showModal = true;
  }

  updateStatus(status: string) {
    if (!this.selectedTicket) return;
    
    this.cmsService.updateTicketStatus(this.selectedTicket.id, status).subscribe({
      next: (ticket) => {
        const idx = this.tickets.findIndex(t => t.id === ticket.id);
        if (idx !== -1) {
          this.tickets[idx] = ticket;
        }
        this.showModal = false;
        this.selectedTicket = null;
      }
    });
  }
}
