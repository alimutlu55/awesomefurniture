export const SERVICE_STATUSES = [
  { key: 'new', label: 'New', stroke: 'service-new' },
  { key: 'retain', label: 'Existing - retain', stroke: 'service-retain' },
  { key: 'remove', label: 'Remove / relocate', stroke: 'service-remove' },
] as const;
export type ServiceStatus = typeof SERVICE_STATUSES[number]['key'];
export const serviceStatus = (key: ServiceStatus | undefined) => SERVICE_STATUSES.find(s => s.key === key);
