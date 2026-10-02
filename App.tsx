import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play,
  Trash2,
  Calendar as CalendarIcon,
  Tag,
  DollarSign,
  List,
  Clock,
  PlusCircle,
  FolderDot,
  LayoutGrid,
  Settings as SettingsIcon,
  LogOut,
  Loader2,
  CreditCard,
  Globe,
  Server as ServerIcon,
  Building2
} from 'lucide-react';
import {
  format,
  isSameDay
} from 'date-fns';
import { EditTimeEntryModal } from './components/EditTimeEntryModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ProjectManager } from './components/ProjectManager';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { DebugConsole } from './components/DebugConsole';
import { PurchaseManager } from './components/PurchaseManager';
import { TimeEntry, AppSettings, Project, Client, License, Server, Domain } from './types';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import * as dbService from './services/db';
import { getCurrentEnv } from './services/firebase';
import { useTimer } from './hooks/useTimer';
import { useFirestoreData } from './hooks/useFirestoreData';
import { groupEntriesByWeek } from './utils/timeGrouping';

// Helper to format duration like "01:00:00" from minutes
const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
};

// Helper to format live seconds counter
const formatSeconds = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const calculateDuration = (start: string, end: string) => {
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
};

type ViewMode = 'timer' | 'projects' | 'licenses' | 'servers' | 'domains' | 'reports' | 'settings';

const App: React.FC = () => {
  const { user, loading, signOut, isAdmin } = useAuth();
  const [view, setView] = useState<ViewMode>('timer');
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [timerBillingFilter, setTimerBillingFilter] = useState<'all' | 'invoiced' | 'not-invoiced'>('all');
  const [timerClientFilter, setTimerClientFilter] = useState<string>('all');

  // Use custom hooks for data and timer management
  const { projects, clients, entries, licenses, servers, domains, settings } = useFirestoreData(user?.uid || null);
  const {
    isRunning: isTimerRunning,
    startTime: timerStartTime,
    elapsedSeconds,
    startTimer,
    stopTimer,
    resetTimer
  } = useTimer();

  // Quick Entry State
  const [newDescription, setNewDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Deletion State
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [licenseToDelete, setLicenseToDelete] = useState<string | null>(null);
  const [serverToDelete, setServerToDelete] = useState<string | null>(null);
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Environment State
  const [env, setEnv] = useState<'prod' | 'dev'>(getCurrentEnv());

  // Listen to env changes to update UI immediately if changed elsewhere
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsProjectPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- HANDLERS (Database Writes) ---

  const handleTimerToggle = async () => {
    if (!user) return;

    if (isTimerRunning) {
      // STOP TIMER Logic
      const endTime = stopTimer();
      const startTime = timerStartTime || new Date();

      const startTimeStr = format(startTime, 'HH:mm');
      const endTimeStr = format(endTime, 'HH:mm');

      if (selectedProjectId) {
        const newEntry: TimeEntry = {
          id: crypto.randomUUID(),
          description: newDescription,
          project: selectedProjectId,
          date: startTime,
          startTime: startTimeStr,
          endTime: endTimeStr,
          billable: true,
          invoiced: false
        };
        // Save to Firestore
        await dbService.saveTimeEntry(user.uid, newEntry);
      }

      // Reset State
      resetTimer();
      setNewDescription('');

    } else {
      // START TIMER Logic
      if (!selectedProjectId) return;
      startTimer();
    }
  };

  const handleSaveEntry = async (savedEntry: TimeEntry) => {
    if (!user) return;
    await dbService.saveTimeEntry(user.uid, savedEntry);
    setActiveEntry(null);
  };

  // Trigger deletion flow (Opens Modal)
  const initiateDelete = (entryId: string) => {
    setEntryToDelete(entryId);
  };

  // Actual Deletion (Called by Modal)
  const confirmDelete = async () => {
    if (!user || !entryToDelete) return;

    setIsDeleting(true);
    try {
      await dbService.deleteTimeEntry(user.uid, entryToDelete);

      // If we were editing this entry, close the edit modal
      if (activeEntry?.id === entryToDelete) {
        setActiveEntry(null);
      }
      // Close confirmation modal
      setEntryToDelete(null);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert("Une erreur est survenue lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Project / Client Handlers ---

  const handleAddProject = async (project: Project) => {
    if (!user) return;
    await dbService.addProject(user.uid, project);
  };

  const handleUpdateProject = async (project: Project) => {
    if (!user) return;
    await dbService.updateProject(user.uid, project);
  };

  const handleDeleteProject = async (id: string) => {
    if (!user) return;
    await dbService.deleteProject(user.uid, id);
  };

  const handleAddClient = async (clientName: string, color?: string) => {
    if (!user) return;
    await dbService.addClient(user.uid, { name: clientName, color });
  };

  const handleUpdateClient = async (client: Client, oldName: string) => {
    if (!user) return;
    await dbService.updateClient(user.uid, client, oldName);
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!user) return;
    await dbService.deleteClient(user.uid, clientId);
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    if (!user) return;
    await dbService.saveSettings(user.uid, newSettings);
  };

  // --- License Handlers ---

  const handleAddLicense = async (name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const newLicense: License = {
      id: crypto.randomUUID(),
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client',
      date: new Date(),
      invoiced: false
    };
    await dbService.saveLicense(user.uid, newLicense);
  };

  const handleUpdateLicense = async (id: string, name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const existing = licenses.find(l => l.id === id);
    if (!existing) return;

    const updatedLicense: License = {
      ...existing,
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client'
    };
    await dbService.saveLicense(user.uid, updatedLicense);
  };

  const toggleLicenseInvoiced = async (license: License) => {
    if (!user) return;
    await dbService.saveLicense(user.uid, {
      ...license,
      invoiced: !license.invoiced
    });
  };

  const initiateDeleteLicense = (id: string) => {
    setLicenseToDelete(id);
  };

  const confirmDeleteLicense = async () => {
    if (!user || !licenseToDelete) return;

    setIsDeleting(true);
    try {
      await dbService.deleteLicense(user.uid, licenseToDelete);
      setLicenseToDelete(null);
    } catch (error) {
      console.error("Failed to delete license:", error);
      alert("Une erreur est survenue lors de la suppression de la licence.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Server Handlers ---

  const handleAddServer = async (name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const newServer: Server = {
      id: crypto.randomUUID(),
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client',
      date: new Date(),
      invoiced: false
    };
    await dbService.saveServer(user.uid, newServer);
  };

  const handleUpdateServer = async (id: string, name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const existing = servers.find(s => s.id === id);
    if (!existing) return;

    const updatedServer: Server = {
      ...existing,
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client'
    };
    await dbService.saveServer(user.uid, updatedServer);
  };

  const toggleServerInvoiced = async (server: Server) => {
    if (!user) return;
    await dbService.saveServer(user.uid, {
      ...server,
      invoiced: !server.invoiced
    });
  };

  const initiateDeleteServer = (id: string) => {
    setServerToDelete(id);
  };

  const confirmDeleteServer = async () => {
    if (!user || !serverToDelete) return;

    setIsDeleting(true);
    try {
      await dbService.deleteServer(user.uid, serverToDelete);
      setServerToDelete(null);
    } catch (error) {
      console.error("Failed to delete server:", error);
      alert("Une erreur est survenue lors de la suppression du serveur.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Domain Handlers ---

  const handleAddDomain = async (name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const newDomain: Domain = {
      id: crypto.randomUUID(),
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client',
      date: new Date(),
      invoiced: false
    };
    await dbService.saveDomain(user.uid, newDomain);
  };

  const handleUpdateDomain = async (id: string, name: string, price: number, projectId: string) => {
    if (!user) return;
    const project = projects.find(p => p.id === projectId);
    const existing = domains.find(d => d.id === id);
    if (!existing) return;

    const updatedDomain: Domain = {
      ...existing,
      name,
      price,
      project: projectId,
      client: project?.client || 'No Client'
    };
    await dbService.saveDomain(user.uid, updatedDomain);
  };

  const toggleDomainInvoiced = async (domain: Domain) => {
    if (!user) return;
    await dbService.saveDomain(user.uid, {
      ...domain,
      invoiced: !domain.invoiced
    });
  };

  const initiateDeleteDomain = (id: string) => {
    setDomainToDelete(id);
  };

  const confirmDeleteDomain = async () => {
    if (!user || !domainToDelete) return;

    setIsDeleting(true);
    try {
      await dbService.deleteDomain(user.uid, domainToDelete);
      setDomainToDelete(null);
    } catch (error) {
      console.error("Failed to delete domain:", error);
      alert("Une erreur est survenue lors de la suppression du domaine.");
    } finally {
      setIsDeleting(false);
    }
  };


  // Grouping Logic - Use utility function with optional filtering
  const groupedEntries = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.id, p]));
    const selectedClientObj = clients.find(c => c.id === timerClientFilter);

    const filteredEntries = entries.filter(e => {
      // 1. Billing Filter
      if (timerBillingFilter === 'invoiced' && !e.invoiced) return false;
      if (timerBillingFilter === 'not-invoiced' && e.invoiced) return false;

      // 2. Client Filter
      if (timerClientFilter !== 'all') {
        const proj = projectMap.get(e.project);
        if (timerClientFilter === 'no-client') {
          if (proj && proj.client) return false;
        } else if (selectedClientObj) {
          if (!proj || proj.client !== selectedClientObj.name) return false;
        }
      }

      return true;
    });

    return groupEntriesByWeek(filteredEntries);
  }, [entries, projects, clients, timerBillingFilter, timerClientFilter]);

  const [licenseFilter, setLicenseFilter] = useState<'all' | 'invoiced' | 'not-invoiced'>('all');
  const [newLicenseName, setNewLicenseName] = useState('');
  const [newLicensePrice, setNewLicensePrice] = useState<number | ''>('');
  const [licenseProjectId, setLicenseProjectId] = useState<string>('');

  const filteredLicenses = useMemo(() => {
    if (licenseFilter === 'invoiced') return licenses.filter(l => l.invoiced);
    if (licenseFilter === 'not-invoiced') return licenses.filter(l => !l.invoiced);
    return licenses;
  }, [licenses, licenseFilter]);

  const renderLicensesView = () => (
    <PurchaseManager
      title="Acheter / Enregistrer une Licence"
      icon={CreditCard}
      items={licenses}
      projects={projects}
      onAddItem={handleAddLicense}
      onToggleInvoiced={toggleLicenseInvoiced}
      onDeleteItem={initiateDeleteLicense}
      onUpdateItem={handleUpdateLicense}
      addButtonLabel="Ajouter la licence"
      emptyLabel="Aucune licence trouvée."
      itemSingular="licence"
      itemPlural="licences"
    />
  );

  const renderServersView = () => (
    <PurchaseManager
      title="Enregistrer un Serveur Web"
      icon={ServerIcon}
      items={servers}
      projects={projects}
      onAddItem={handleAddServer}
      onToggleInvoiced={toggleServerInvoiced}
      onDeleteItem={initiateDeleteServer}
      onUpdateItem={handleUpdateServer}
      addButtonLabel="Ajouter le serveur"
      emptyLabel="Aucun serveur trouvé."
      itemSingular="serveur"
      itemPlural="serveurs"
    />
  );

  const renderDomainsView = () => (
    <PurchaseManager
      title="Enregistrer un Nom de Domaine"
      icon={Globe}
      items={domains}
      projects={projects}
      onAddItem={handleAddDomain}
      onToggleInvoiced={toggleDomainInvoiced}
      onDeleteItem={initiateDeleteDomain}
      onUpdateItem={handleUpdateDomain}
      addButtonLabel="Ajouter le domaine"
      emptyLabel="Aucun domaine trouvé."
      itemSingular="domaine"
      itemPlural="domaines"
    />
  );


  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedClientObj = clients.find(c => c.id === timerClientFilter);

  const groupedTimerProjects = useMemo(() => {
    let filtered = projects.filter(p => p.active !== false);
    if (timerClientFilter === 'no-client') {
      filtered = filtered.filter(p => !p.client);
    } else if (timerClientFilter !== 'all') {
      const client = clients.find(c => c.id === timerClientFilter);
      if (client) {
        filtered = filtered.filter(p => p.client === client.name);
      }
    }

    const groups: { [key: string]: Project[] } = {};
    filtered.forEach(p => {
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
  }, [projects, timerClientFilter, clients]);

  // --- Render Views ---

  const renderTimerView = () => (
    <>
      {/* Top Bar - "What are you working on?" */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">

          <input
            type="text"
            placeholder="What are you working on?"
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 text-base min-w-[200px]"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />

          {/* Project Selector */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setIsProjectPickerOpen(!isProjectPickerOpen)}
              className={`flex items-center font-medium transition-colors text-sm px-2 py-1 rounded hover:bg-gray-50
                ${selectedProject ? '' : 'text-blue-500 hover:text-blue-600'}
              `}
            >
              {selectedProject ? (
                <div className="flex items-center text-sm" style={{ color: selectedProject.color }}>
                  <div
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: selectedProject.color }}
                  />
                  <span className="font-bold mr-1">{selectedProject.name}</span>
                </div>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  Project
                </>
              )}
            </button>

            {/* Project Dropdown */}
            {isProjectPickerOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-500 uppercase tracking-wider truncate">
                    {timerClientFilter === 'all'
                      ? 'Select Project'
                      : timerClientFilter === 'no-client'
                        ? 'Sans client'
                        : selectedClientObj?.name || 'Client'}
                  </span>
                  {timerClientFilter !== 'all' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTimerClientFilter('all');
                      }}
                      className="text-blue-500 hover:text-blue-700 font-medium ml-2 text-[11px]"
                    >
                      Tous
                    </button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {groupedTimerProjects.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400 text-center">
                      {timerClientFilter !== 'all' ? (
                        <div>
                          <span>Aucun projet pour ce client.</span><br />
                          <button
                            type="button"
                            className="text-blue-500 hover:underline mt-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimerClientFilter('all');
                            }}
                          >
                            Afficher tous les projets
                          </button>
                        </div>
                      ) : (
                        <>No projects found.<br />Go to Projects to create one.</>
                      )}
                    </div>
                  ) : (
                    groupedTimerProjects.map(group => (
                      <div key={group.clientName}>
                        {timerClientFilter === 'all' && (
                          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/80 border-y border-gray-50">
                            {group.clientName}
                          </div>
                        )}
                        {group.projects.map(project => (
                          <button
                            key={project.id}
                            onClick={() => {
                              setSelectedProjectId(project.id);
                              setIsProjectPickerOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between group"
                          >
                            <div className="flex items-center">
                              <div
                                className="w-2.5 h-2.5 rounded-full mr-3"
                                style={{ backgroundColor: project.color }}
                              />
                              <span className="text-gray-700 font-medium group-hover:text-gray-900">{project.name}</span>
                            </div>
                            {project.client && timerClientFilter !== 'all' && (
                              <span className="text-xs text-gray-400">{project.client}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                  <button
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-blue-500 text-sm flex items-center border-t border-gray-50 mt-1"
                    onClick={() => {
                      setIsProjectPickerOpen(false);
                      setView('projects');
                    }}
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Manage projects
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

          <div className="font-mono text-xl text-gray-800 font-medium w-24 text-center hidden sm:block">
            {formatSeconds(elapsedSeconds)}
          </div>

          <button
            onClick={handleTimerToggle}
            disabled={!isTimerRunning && !selectedProjectId}
            className={`
              font-bold py-2 px-6 rounded shadow-sm transition-all text-sm tracking-wide
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none
              ${isTimerRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'}
            `}
            title={!isTimerRunning && !selectedProjectId ? "Please select a project first" : ""}
          >
            {isTimerRunning ? 'STOP' : 'START'}
          </button>

          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded hidden sm:block">
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Filter Bar (Client & Billing Status) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-md">
                <List className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Entrées de temps</h3>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Filtrer l'affichage</p>
              </div>
            </div>

            {/* Client Filter Dropdown */}
            <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select
                value={timerClientFilter}
                onChange={(e) => {
                  const newClient = e.target.value;
                  setTimerClientFilter(newClient);
                  if (newClient !== 'all') {
                    const clientObj = clients.find(c => c.id === newClient);
                    const curProject = projects.find(p => p.id === selectedProjectId);
                    if (curProject) {
                      if (newClient === 'no-client' && curProject.client) {
                        setSelectedProjectId(null);
                      } else if (newClient !== 'no-client' && clientObj && curProject.client !== clientObj.name) {
                        setSelectedProjectId(null);
                      }
                    }
                  }
                }}
                className="text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">Tous les clients ({clients.length})</option>
                <option value="no-client">Sans client</option>
                <optgroup label="Clients">
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Billing Status Filter */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100 self-start md:self-auto">
            <button
              onClick={() => setTimerBillingFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timerBillingFilter === 'all' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Tout
            </button>
            <button
              onClick={() => setTimerBillingFilter('not-invoiced')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timerBillingFilter === 'not-invoiced' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              À facturer
            </button>
            <button
              onClick={() => setTimerBillingFilter('invoiced')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timerBillingFilter === 'invoiced' ? 'bg-white text-green-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Facturé
            </button>
          </div>
        </div>
        {groupedEntries.map((week, weekIdx) => (
          <div key={weekIdx}>
            {/* Week Header */}
            <div className="flex justify-between items-end mb-2 px-1">
              <h2 className="text-gray-500 text-xs font-semibold">
                {weekIdx === 0 ? 'This week' : `${format(week.start, 'MMM d')} - ${format(week.end, 'MMM d')}`}
              </h2>
              <div className="text-gray-500 text-xs">
                Week total: <span className="font-bold text-gray-700 ml-1">{formatDuration(week.duration)}</span>
              </div>
            </div>

            <div className="shadow-sm border border-gray-200 rounded-lg overflow-hidden bg-white">
              {week.days.map((day, dayIdx) => (
                <div key={dayIdx}>
                  {/* Day Header */}
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center text-xs text-gray-500 border-b border-gray-100">
                    <span className="font-medium">
                      {isSameDay(day.date, new Date()) ? 'Today' :
                        isSameDay(day.date, new Date(Date.now() - 86400000)) ? 'Yesterday' :
                          format(day.date, 'EEE, MMM d')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>Total: <span className="font-bold text-gray-700">{formatDuration(day.duration)}</span></span>
                      <button className="hover:text-gray-800"><CalendarIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Entries Rows */}
                  <div className="divide-y divide-gray-100">
                    {day.entries.map((entry) => {
                      const project = projects.find(p => p.id === entry.project);
                      const duration = calculateDuration(entry.startTime, entry.endTime);

                      return (
                        <div
                          key={entry.id}
                          className={`group bg-white hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100 flex flex-col sm:flex-row ${entry.invoiced ? 'border-l-4 border-l-green-500 bg-green-50/20' : ''}`}
                        >
                          {/* 
                             ZONE CLIQUABLE (ÉDITION)
                             Cette zone contient la description, le projet et les infos temporelles.
                             Elle est séparée physiquement des boutons d'action.
                          */}
                          <div
                            className="flex-1 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-2 sm:gap-4 min-w-0"
                            onClick={() => setActiveEntry(entry)}
                          >
                            {/* Left: Desc + Project */}
                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <span className="font-medium text-gray-900 truncate">
                                {entry.description || "(No description)"}
                              </span>

                              {project && (
                                <div className="flex items-center text-sm whitespace-nowrap">
                                  <div
                                    className="w-1.5 h-1.5 rounded-full mr-2 flex-shrink-0"
                                    style={{ backgroundColor: project.color }}
                                  />
                                  <span className="font-semibold mr-1.5" style={{ color: project.color }}>
                                    {project.name}
                                  </span>
                                  {project.client && (
                                    <span className="text-gray-500">
                                      - {project.client}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right: Stats (Time, Duration) - MOVED HERE */}
                            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-6 text-sm">
                              <div className="flex items-center gap-1">
                                {entry.invoiced && (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-200">
                                    <DollarSign className="w-3 h-3" />
                                    <span>Facturé</span>
                                  </div>
                                )}
                              </div>
                              <div className="text-gray-500 tabular-nums text-xs sm:text-sm">
                                {entry.startTime} - {entry.endTime}
                              </div>
                              <div className="font-bold text-gray-800 tabular-nums w-16 text-right text-base">
                                {formatDuration(duration)}
                              </div>
                            </div>
                          </div>

                          {/* 
                             ZONE ACTIONS (BOUTONS)
                          */}
                          <div className="flex items-center justify-end px-4 pb-3 sm:py-3 sm:pl-0 sm:pr-4 gap-1">
                            <button
                              type="button"
                              className="p-1.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isTimerRunning) {
                                  setSelectedProjectId(entry.project);
                                  setNewDescription(entry.description);
                                }
                              }}
                              title="Continue this task"
                            >
                              <Play className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors relative z-10"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                initiateDelete(entry.id);
                              }}
                              title="Supprimer l'entrée"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {groupedEntries.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            {timerClientFilter !== 'all' || timerBillingFilter !== 'all' ? (
              <div>
                <p className="font-medium text-gray-600">Aucune entrée ne correspond aux filtres appliqués.</p>
                <button
                  type="button"
                  onClick={() => {
                    setTimerClientFilter('all');
                    setTimerBillingFilter('all');
                  }}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <p>No time entries found. Start the timer above!</p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
    </>
  );

  const renderContent = () => {
    switch (view) {
      case 'projects':
        return (
          <ProjectManager
            projects={projects}
            onUpdateProjects={() => { }}
            // @ts-ignore
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}

            clients={clients}
            onUpdateClients={() => { }}
            // @ts-ignore
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}

            entries={entries}
            settings={settings}
          />
        );
      case 'reports':
        return (
          <Reports
            entries={entries}
            projects={projects}
            settings={settings}
            clients={clients}
            licenses={licenses}
            servers={servers}
            domains={domains}
          />
        );
      case 'settings':
        return (
          <Settings
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        );
      case 'licenses':
        return renderLicensesView();
      case 'servers':
        return renderServersView();
      case 'domains':
        return renderDomainsView();
      case 'timer':
      default:
        return renderTimerView();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navigation Bar */}
      <div className={`border-b px-4 py-2 flex justify-between items-center shadow-sm sticky top-0 z-40 transition-colors ${env === 'dev' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${env === 'dev' ? 'bg-amber-500' : 'bg-blue-600'}`}>
            <Clock className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 hidden sm:inline">
            TimeEdit Pro
            {env === 'dev' && <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 uppercase">Dev Mode</span>}
          </span>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 gap-1 overflow-x-auto">
          <button
            onClick={() => setView('timer')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'timer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Timer</span>
          </button>
          <button
            onClick={() => setView('projects')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'projects' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FolderDot className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>
          <button
            onClick={() => setView('reports')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Reports</span>
          </button>
          <button
            onClick={() => setView('licenses')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'licenses' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Licences</span>
          </button>
          <button
            onClick={() => setView('servers')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'servers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ServerIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Serveurs</span>
          </button>
          <button
            onClick={() => setView('domains')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'domains' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Domaines</span>
          </button>
          <button
            onClick={() => setView('settings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="hidden md:inline-block px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded uppercase tracking-wider">
              Admin
            </span>
          )}
          <button
            onClick={signOut}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      <DebugConsole />

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 z-50">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {!loading && !user && (
        <div className="fixed inset-0 z-40 bg-gray-100">
          <Login />
        </div>
      )}

      {activeEntry && (
        <EditTimeEntryModal
          isOpen={!!activeEntry}
          entry={activeEntry}
          projects={projects}
          onClose={() => setActiveEntry(null)}
          onSave={handleSaveEntry}
          onDelete={initiateDelete}
        />
      )}

      <ConfirmModal
        isOpen={!!licenseToDelete}
        title="Supprimer la licence"
        message="Voulez-vous vraiment supprimer cette licence ? Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
        isLoading={isDeleting}
        onConfirm={confirmDeleteLicense}
        onCancel={() => setLicenseToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!serverToDelete}
        title="Supprimer le serveur"
        message="Voulez-vous vraiment supprimer ce serveur ? Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
        isLoading={isDeleting}
        onConfirm={confirmDeleteServer}
        onCancel={() => setServerToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!domainToDelete}
        title="Supprimer le domaine"
        message="Voulez-vous vraiment supprimer ce domaine ? Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
        isLoading={isDeleting}
        onConfirm={confirmDeleteDomain}
        onCancel={() => setDomainToDelete(null)}
      />

      <ConfirmModal
        isOpen={!!entryToDelete}
        title="Supprimer l'entrée"
        message="Voulez-vous vraiment supprimer cette entrée de temps ? Cette action est irréversible."
        confirmLabel="Supprimer"
        isDestructive
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};

export default App;