import { useTranslation } from 'react-i18next';
import { useSupplyItems, updateSupplyPriority, SupplyItem } from '../lib/firebaseRealtimeSync';
import { useState } from 'react';

type Priority = 'HIGH' | 'MODERATE' | 'LOW';

const PRIORITY_CONFIG: Record<Priority, { label: string; dot: string; ring: string; badge: string; icon: string }> = {
  HIGH:     { label: 'Highest', dot: 'bg-red-500',    ring: 'ring-red-300',    badge: 'priority-high', icon: '🔴' },
  MODERATE: { label: 'Moderate', dot: 'bg-yellow-500', ring: 'ring-yellow-300', badge: 'priority-mod',  icon: '🟡' },
  LOW:      { label: 'Lowest',  dot: 'bg-green-500',  ring: 'ring-green-300',  badge: 'priority-low',  icon: '🟢' },
};

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-neutral-100 text-neutral-600',
  'in-transit': 'bg-blue-100 text-blue-700',
  delivered:  'bg-green-100 text-green-700',
};

export default function SupplyPriorityManager() {
  const { t } = useTranslation();
  const items = useSupplyItems();
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Priority | 'ALL'>('ALL');

  const handlePriorityChange = async (item: SupplyItem, newPriority: Priority) => {
    if (item.priority === newPriority) return;
    setSaving(item.id);
    await updateSupplyPriority(item.id, newPriority);
    setSaving(null);
  };

  const filtered = filter === 'ALL' ? items : items.filter(i => i.priority === filter);

  // Demo data when Firebase is not yet configured
  const displayItems: SupplyItem[] = filtered.length > 0 ? filtered : [
    { id: 'demo-1', name: 'Medical Kits', category: 'Medical', quantity: 500, unit: 'units', priority: 'HIGH', assignedVehicleId: 'V001', status: 'in-transit', updatedAt: null },
    { id: 'demo-2', name: 'Food Packets', category: 'Food', quantity: 2000, unit: 'packets', priority: 'MODERATE', assignedVehicleId: 'V002', status: 'pending', updatedAt: null },
    { id: 'demo-3', name: 'Tarpaulin Sheets', category: 'Shelter', quantity: 300, unit: 'sheets', priority: 'LOW', assignedVehicleId: null, status: 'pending', updatedAt: null },
    { id: 'demo-4', name: 'Water Purifiers', category: 'Water', quantity: 50, unit: 'units', priority: 'HIGH', assignedVehicleId: 'V003', status: 'in-transit', updatedAt: null },
    { id: 'demo-5', name: 'Blankets', category: 'Shelter', quantity: 1000, unit: 'units', priority: 'MODERATE', assignedVehicleId: null, status: 'pending', updatedAt: null },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-neutral-500">Filter:</span>
        {(['ALL', 'HIGH', 'MODERATE', 'LOW'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
              filter === f
                ? f === 'ALL' ? 'bg-neutral-800 text-white border-neutral-800'
                  : f === 'HIGH' ? 'bg-red-600 text-white border-red-600'
                  : f === 'MODERATE' ? 'bg-yellow-500 text-white border-yellow-500'
                  : 'bg-green-600 text-white border-green-600'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {f === 'ALL' ? 'All' : PRIORITY_CONFIG[f].icon + ' ' + PRIORITY_CONFIG[f].label}
          </button>
        ))}
        <span className="ml-auto text-xs text-neutral-400">{displayItems.length} items</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-100">
              <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3">Supply Item</th>
              <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden sm:table-cell">Category</th>
              <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden md:table-cell">Qty</th>
              <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3 hidden md:table-cell">Status</th>
              <th className="text-left text-xs font-semibold text-neutral-500 px-4 py-3">{t('priority')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayItems.map(item => {
              const cfg = PRIORITY_CONFIG[item.priority];
              return (
                <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} shrink-0`} />
                      <span className="text-sm font-medium text-neutral-800">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-neutral-500">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm font-medium text-neutral-700">{item.quantity.toLocaleString()} {item.unit}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[item.status] || 'bg-neutral-100 text-neutral-600'}`}>
                      {item.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(['HIGH', 'MODERATE', 'LOW'] as Priority[]).map(p => (
                        <button
                          key={p}
                          onClick={() => handlePriorityChange(item, p)}
                          disabled={saving === item.id}
                          title={PRIORITY_CONFIG[p].label}
                          className={`text-base transition-all rounded-full p-0.5 ${
                            item.priority === p
                              ? `scale-110 ring-2 ${cfg.ring}`
                              : 'opacity-40 hover:opacity-80 hover:scale-105'
                          } disabled:cursor-wait`}
                        >
                          {PRIORITY_CONFIG[p].icon}
                        </button>
                      ))}
                      {saving === item.id && (
                        <span className="text-xs text-neutral-400 ml-1">saving…</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
