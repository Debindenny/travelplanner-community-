/**
 * CustomerRow — typed interface matching the exact shape of the current
 * customer.component.ts hardcoded literal. Critical mapping responsibility
 * lives in the service, not the component.
 */
export interface CustomerRow {
  id: string;
  displayCode: string;
  name: string;
  email: string;
  phone: string;
  type: 'Couple' | 'Solo' | 'Family' | 'Friends' | string;
  dateJoined: string;
  lastLogin: string;
  isActive: boolean;
  ltv: number;
  segment: string;
  stats: {
    cancelled: number;
    itineraries: number;
    booked: number;
    pending: number;
    created: number;
  };
}

/** Customer KPIs */
export interface CustomerKpis {
  total: number;
  active: number;
  inactive: number;
}

/** Customer list API response (before mapping to component shape) */
export interface CustomerApiResponse {
  kpis: CustomerKpis;
  items: CustomerApiItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface CustomerApiItem {
  id: string;
  display_code: string;
  name: string;
  email: string;
  phone: string | null;
  customer_type: string | null;
  date_joined: string;
  is_active: boolean;
  ltv: number;
  segment: string;
}

/** Create customer request */
export interface CreateCustomerRequest {
  name: string;
  email: string;
  phone?: string;
  customer_type?: string;
}
