export type InventoryType = 'hotel' | 'train' | 'bus' | 'car' | 'flight' | 'activity' | 'place';

export interface InventoryItem {
  id: string;
  type: string;
  provider: string;
  title: string;
  price: number;
  currency: string;
  deep_link: string;
  start_time?: string;
  end_time?: string;
  duration?: string;
  details?: Record<string, unknown>;
}

export interface InventoryTab {
  id: InventoryType;
  label: string;
}

export const INVENTORY_TABS: InventoryTab[] = [
  { id: 'hotel', label: 'Hotels' },
  { id: 'train', label: 'Trains' },
  { id: 'bus', label: 'Buses' },
  { id: 'car', label: 'Cars' },
  { id: 'flight', label: 'Flights' },
  { id: 'activity', label: 'Activities' },
  { id: 'place', label: 'Places' },
];
