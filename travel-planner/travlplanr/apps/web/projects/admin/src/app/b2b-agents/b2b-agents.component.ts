import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface Agent {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

@Component({
    selector: 'app-b2b-agents',
    imports: [CommonModule],
    templateUrl: './b2b-agents.component.html',
    styleUrls: ['./b2b-agents.component.scss']
})
export class B2bAgentsComponent implements OnInit {
  private http = inject(HttpClient);
  
  agents: Agent[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.isLoading = true;
    this.http.get<{items: Agent[]}>(`${environment.identityPath}/admin/agents`).subscribe({
      next: (res) => {
        this.agents = res.items;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load agents', err);
        this.isLoading = false;
      }
    });
  }

  approveAgent(agentId: string): void {
    this.http.post(`${environment.identityPath}/admin/agents/${agentId}/approve`, {}).subscribe({
      next: () => this.loadAgents(),
      error: (err) => console.error('Failed to approve agent', err)
    });
  }

  rejectAgent(agentId: string): void {
    this.http.post(`${environment.identityPath}/admin/agents/${agentId}/reject`, {}).subscribe({
      next: () => this.loadAgents(),
      error: (err) => console.error('Failed to reject agent', err)
    });
  }
}
