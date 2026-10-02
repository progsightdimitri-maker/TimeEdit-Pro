import React, { useState, useMemo } from 'react';
import { Trash2, DollarSign, CreditCard, Pencil, Check, X } from 'lucide-react';
import { Project } from '../types';

interface PurchaseItem {
    id: string;
    name: string;
    price: number;
    project: string;
    client: string;
    date: Date;
    invoiced: boolean;
}

interface PurchaseManagerProps {
    title: string;
    icon: React.ElementType;
    items: PurchaseItem[];
    projects: Project[];
    onAddItem: (name: string, price: number, projectId: string) => Promise<void>;
    onToggleInvoiced: (item: any) => Promise<void>;
    onDeleteItem: (id: string) => void;
    onUpdateItem?: (id: string, name: string, price: number, projectId: string) => Promise<void>;
    addButtonLabel: string;
    emptyLabel: string;
    itemSingular: string;
    itemPlural: string;
}

export const PurchaseManager: React.FC<PurchaseManagerProps> = ({
    title,
    icon: Icon,
    items,
    projects,
    onAddItem,
    onToggleInvoiced,
    onDeleteItem,
    onUpdateItem,
    addButtonLabel,
    emptyLabel,
    itemSingular,
    itemPlural
}) => {
    const [filter, setFilter] = useState<'all' | 'invoiced' | 'not-invoiced'>('all');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState<number | ''>('');
    const [projectId, setProjectId] = useState<string>('');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState<number | ''>('');
    const [editProjectId, setEditProjectId] = useState('');

    const filteredItems = useMemo(() => {
        if (filter === 'invoiced') return items.filter(i => i.invoiced);
        if (filter === 'not-invoiced') return items.filter(i => !i.invoiced);
        return items;
    }, [items, filter]);

    const handleAdd = async () => {
        if (newName && newPrice !== '' && projectId) {
            await onAddItem(newName, Number(newPrice), projectId);
            setNewName('');
            setNewPrice('');
        }
    };

    const handleStartEdit = (item: PurchaseItem) => {
        setEditingId(item.id);
        setEditName(item.name);
        setEditPrice(item.price);
        setEditProjectId(item.project);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditName('');
        setEditPrice('');
        setEditProjectId('');
    };

    const handleSaveEdit = async () => {
        if (editingId && editName && editPrice !== '' && editProjectId && onUpdateItem) {
            await onUpdateItem(editingId, editName, Number(editPrice), editProjectId);
            handleCancelEdit();
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Icon className="w-6 h-6 text-blue-600" />
                    {title}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Désignation</label>
                        <input
                            type="text"
                            placeholder="Ex: Licence JetBrains, Hébergement AWS..."
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Prix (€)</label>
                        <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Projet</label>
                        <select
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                        >
                            <option value="">Sélectionner</option>
                            {[...projects]
                                .filter(p => p.active !== false)
                                .sort((a, b) => {
                                    const cA = a.client || '';
                                    const cB = b.client || '';
                                    if (cA !== cB) return cA.localeCompare(cB);
                                    return a.name.localeCompare(b.name);
                                })
                                .map(p => (
                                    <option key={p.id} value={p.id}>{p.name}{p.client ? ` (${p.client})` : ''}</option>
                                ))}
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleAdd}
                        disabled={!newName || newPrice === '' || !projectId}
                        className="bg-blue-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                    >
                        {addButtonLabel}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 bg-gray-200 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Toutes
                        </button>
                        <button
                            onClick={() => setFilter('not-invoiced')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'not-invoiced' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            À refacturer
                        </button>
                        <button
                            onClick={() => setFilter('invoiced')}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filter === 'invoiced' ? 'bg-white text-green-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Déjà refacturées
                        </button>
                    </div>
                    <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                        {filteredItems.length} {filteredItems.length === 1 ? itemSingular : itemPlural}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <Icon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="font-medium text-sm">{emptyLabel}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors ${item.invoiced ? 'border-l-4 border-l-green-500 bg-green-50/20' : ''}`}
                                >
                                    {editingId === item.id ? (
                                        // Editing Mode
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                            <div className="md:col-span-2">
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="number"
                                                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
                                                    value={editProjectId}
                                                    onChange={(e) => setEditProjectId(e.target.value)}
                                                >
                                                    {[...projects]
                                                        .sort((a, b) => {
                                                            const cA = a.client || '';
                                                            const cB = b.client || '';
                                                            if (cA !== cB) return cA.localeCompare(cB);
                                                            return a.name.localeCompare(b.name);
                                                        })
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}{p.client ? ` (${p.client})` : ''}</option>
                                                        ))}
                                                </select>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        disabled={!editName || editPrice === '' || !editProjectId}
                                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30"
                                                        title="Sauvegarder"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={handleCancelEdit}
                                                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                        title="Annuler"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Normal Mode
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                                                        {projects.find(p => p.id === item.project)?.name || "Projet inconnu"}
                                                    </span>
                                                    <span className="text-xs text-gray-400 font-medium truncate">
                                                        {item.client}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-lg font-mono font-bold text-gray-900 tabular-nums">
                                                    {item.price.toFixed(2)}€
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {item.invoiced ? (
                                                        <div
                                                            className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-200 cursor-pointer hover:bg-green-200 transition-all shadow-sm"
                                                            onClick={() => onToggleInvoiced(item)}
                                                        >
                                                            <DollarSign className="w-3 h-3" />
                                                            <span>Facturé</span>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => onToggleInvoiced(item)}
                                                            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 border border-blue-200 text-blue-600 rounded-full hover:bg-blue-50 transition-all shadow-sm"
                                                        >
                                                            À refacturer
                                                        </button>
                                                    )}

                                                    <div className="h-6 w-px bg-gray-100 mx-1"></div>

                                                    {!item.invoiced && (
                                                        <button
                                                            onClick={() => handleStartEdit(item)}
                                                            className="p-1.5 text-gray-300 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                                                            title="Modifier"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => onDeleteItem(item.id)}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
