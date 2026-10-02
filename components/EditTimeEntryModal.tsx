import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Trash2, DollarSign, CheckCircle2 } from 'lucide-react';
import { TimeEntry, Project } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { generateDescription } from '../services/geminiService';

interface EditTimeEntryModalProps {
  entry: TimeEntry;
  projects: Project[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntry: TimeEntry) => void;
  onDelete: (entryId: string) => void;
}

export const EditTimeEntryModal: React.FC<EditTimeEntryModalProps> = ({
  entry,
  projects,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [description, setDescription] = useState(entry.description);
  const [projectId, setProjectId] = useState(entry.project);
  const [date, setDate] = useState(entry.date);
  const [startTime, setStartTime] = useState(entry.startTime);
  const [endTime, setEndTime] = useState(entry.endTime);
  
  // Billing States
  const [billable, setBillable] = useState(entry.billable ?? true);
  const [invoiced, setInvoiced] = useState(entry.invoiced ?? false);

  const [isGenerating, setIsGenerating] = useState(false);

  // Group projects by client (sorted by client then project name)
  const groupedProjects = useMemo(() => {
    const validProjects = projects.filter(p => p.active !== false || p.id === projectId);
    
    const groups: { [key: string]: Project[] } = {};
    validProjects.forEach(p => {
      const clientKey = p.client ? p.client : 'Sans client';
      if (!groups[clientKey]) groups[clientKey] = [];
      groups[clientKey].push(p);
    });

    const sortedClients = Object.keys(groups).sort((a, b) => {
      if (a === 'Sans client') return 1;
      if (b === 'Sans client') return -1;
      return a.localeCompare(b);
    });

    return sortedClients.map(clientName => ({
      clientName,
      projects: groups[clientName].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [projects, projectId]);

  // Reset form when entry changes
  useEffect(() => {
    setDescription(entry.description);
    setProjectId(entry.project);
    setDate(entry.date);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setBillable(entry.billable ?? true);
    setInvoiced(entry.invoiced ?? false);
  }, [entry, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...entry,
      description,
      project: projectId,
      date,
      startTime,
      endTime,
      billable,
      invoiced
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(entry.id);
  };

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    const projName = projects.find(p => p.id === projectId)?.name || 'Unknown Project';
    const desc = await generateDescription(projName, startTime, endTime, date.toDateString());
    setDescription(desc);
    setIsGenerating(false);
  };

  return (
    <div className="relative z-[100]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Scrollable Container */}
      <div className="fixed inset-0 z-[100] w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          
          {/* Modal Panel */}
          <div className="relative transform rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 rounded-t-xl bg-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Time Entry</h3>
                <p className="text-sm text-gray-500 mt-0.5">Update the details for your time entry.</p>
              </div>
              <button 
                onClick={onClose}
                type="button"
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-6 space-y-6 bg-white">
              
              {/* Description */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <button 
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={isGenerating}
                    className="text-xs flex items-center text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
                    title="Generate description with AI"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    {isGenerating ? 'Generating...' : 'Auto-fill'}
                  </button>
                </div>
                <Input 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you working on?"
                />
              </div>

              {/* Project */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white text-gray-900"
                >
                  {groupedProjects.map(group => (
                    <optgroup key={group.clientName} label={group.clientName}>
                      {group.projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.client ? `${p.client} — ${p.name}` : p.name}{p.active === false ? ' (Archived)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Date & Time Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                   <DatePicker 
                     label="Date"
                     selectedDate={date}
                     onChange={setDate}
                   />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <div className="flex items-center space-x-2">
                    <Input 
                      type="time" 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-center"
                    />
                    <span className="text-gray-400 font-medium">-</span>
                    <Input 
                      type="time" 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Billing Status */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 space-y-3">
                 <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Billing Status</h4>
                 
                 <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            checked={billable}
                            onChange={(e) => {
                                setBillable(e.target.checked);
                                if (!e.target.checked) setInvoiced(false); // Can't be invoiced if not billable
                            }}
                        />
                        <span className="ml-2 text-sm text-gray-900 flex items-center gap-1">
                            Facturable <span className="text-gray-400 text-xs">(Billable)</span>
                        </span>
                    </label>

                    <label className={`flex items-center ${!billable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input 
                            type="checkbox" 
                            className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                            checked={invoiced}
                            onChange={(e) => setInvoiced(e.target.checked)}
                            disabled={!billable}
                        />
                        <span className="ml-2 text-sm text-gray-900 flex items-center gap-1">
                            <span className={invoiced ? "text-green-600 font-medium" : ""}>Déjà facturée</span> 
                            <span className="text-gray-400 text-xs">(Invoiced)</span>
                        </span>
                    </label>
                 </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 flex justify-between items-center bg-gray-50/50 rounded-b-xl">
              <button 
                type="button"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <Button onClick={handleSave}>
                    Save Changes
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};