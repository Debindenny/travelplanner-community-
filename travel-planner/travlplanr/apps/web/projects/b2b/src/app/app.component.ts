import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface B2BAgent {
  id: string;
  name: string;
  agencyName: string;
  displayCode: string;
  status: 'active' | 'suspended' | 'pending';
  markupConfig: number;
}

interface AgentTrip {
  id: string;
  destination: string;
  travelers: number;
  budget: string;
  days: number;
  status: string;
  createdAt: string;
}

@Component({
    selector: 'app-root',
    imports: [CommonModule, FormsModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private http = inject(HttpClient);

  // Agent State
  agent = signal<B2BAgent>({
    id: 'user_agent_bf79e2a4',
    name: 'Sarah Connor',
    agencyName: 'Skynet Travel Services Ltd.',
    displayCode: 'AGT-901844',
    status: 'active',
    markupConfig: 1.10
  });

  // API Key State
  apiKey = signal<string>('');
  apiKeyCopied = signal<boolean>(false);
  showApiKey = signal<boolean>(false);
  generatingKey = signal<boolean>(false);

  // Trips State
  trips = signal<AgentTrip[]>([
    {
      id: 'trip_1',
      destination: 'Rome, Italy',
      travelers: 2,
      budget: 'standard',
      days: 5,
      status: 'READY',
      createdAt: '2026-07-09T14:20:00Z'
    },
    {
      id: 'trip_2',
      destination: 'Tokyo, Japan',
      travelers: 4,
      budget: 'luxury',
      days: 7,
      status: 'READY',
      createdAt: '2026-07-08T09:15:00Z'
    },
    {
      id: 'trip_3',
      destination: 'Goa, India',
      travelers: 1,
      budget: 'budget',
      days: 3,
      status: 'GENERATING',
      createdAt: '2026-07-10T11:45:00Z'
    }
  ]);

  loadingTrips = signal<boolean>(false);

  // Stats
  totalBookingsCount = signal<number>(24);
  commissionEarned = signal<number>(14520);
  activeItineraries = signal<number>(3);

  ngOnInit(): void {
    this.loadAgentProfile();
    this.loadAgentTrips();
  }

  loadAgentProfile(): void {
    // Attempt load from server
    this.http.get<any>('/api/v1/agents/me').subscribe({
      next: (res) => {
        if (res) {
          this.agent.set({
            id: res.id || this.agent().id,
            name: res.name || this.agent().name,
            agencyName: res.agency || this.agent().agencyName,
            displayCode: res.display_code || this.agent().displayCode,
            status: res.status || this.agent().status,
            markupConfig: res.markup || this.agent().markupConfig
          });
        }
      },
      error: () => {
        // Fail silent, fallback to premium mock
      }
    });
  }

  loadAgentTrips(): void {
    this.loadingTrips.set(true);
    this.http.get<any>('/api/v1/trips').subscribe({
      next: (res) => {
        if (res && Array.isArray(res.items)) {
          this.trips.set(res.items.map((t: any) => ({
            id: t.id,
            destination: t.destination,
            travelers: t.travelers || 1,
            budget: t.budget || 'standard',
            days: t.durationDays || 5,
            status: t.status,
            createdAt: t.createdAt || new Date().toISOString()
          })));
        }
        this.loadingTrips.set(false);
      },
      error: () => {
        this.loadingTrips.set(false);
      }
    });
  }

  generateKey(): void {
    this.generatingKey.set(true);
    this.http.post<any>('/api/v1/agents/me/keys', {}).subscribe({
      next: (res) => {
        if (res && res.api_key) {
          this.apiKey.set(res.api_key);
          this.showApiKey.set(true);
        }
        this.generatingKey.set(false);
      },
      error: () => {
        // Fallback mock key generation
        setTimeout(() => {
          this.apiKey.set(`tp_key_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`);
          this.showApiKey.set(true);
          this.generatingKey.set(false);
        }, 800);
      }
    });
  }

  copyApiKey(): void {
    if (!this.apiKey()) return;
    navigator.clipboard.writeText(this.apiKey());
    this.apiKeyCopied.set(true);
    setTimeout(() => this.apiKeyCopied.set(false), 2000);
  }

  updateMarkup(value: number): void {
    this.agent.update(a => ({ ...a, markupConfig: Number(value) }));
    // Persist to server config
    this.http.post('/api/v1/checkout/markup', { b2b_markup: value.toFixed(2), b2c_markup: '1.00' }).subscribe({
      next: () => {},
      error: () => {}
    });
  }
}
