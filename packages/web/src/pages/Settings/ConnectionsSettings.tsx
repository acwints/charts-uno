import { useState, useEffect, useCallback } from 'react';
import Database from 'lucide-react/dist/esm/icons/database';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Pencil from 'lucide-react/dist/esm/icons/pencil';
import Zap from 'lucide-react/dist/esm/icons/zap';
import X from 'lucide-react/dist/esm/icons/x';
import { useTeam } from '../../contexts/TeamContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/Button';
import {
  getSqlConnections,
  createSqlConnection,
  updateSqlConnection,
  deleteSqlConnection,
  testSqlConnection,
  getTeamMembers,
  type SqlConnectionResponse,
} from '../../services/api';

interface ConnectionForm {
  name: string;
  host: string;
  port: number;
  database_name: string;
  username: string;
  password: string;
  ssl_required: boolean;
}

const EMPTY_FORM: ConnectionForm = {
  name: '',
  host: '',
  port: 5432,
  database_name: '',
  username: '',
  password: '',
  ssl_required: true,
};

export function ConnectionsSettings() {
  const { currentTeam } = useTeam();
  const { user } = useAuth();
  const toast = useToast();

  const [connections, setConnections] = useState<SqlConnectionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!currentTeam) return;
    setIsLoading(true);
    try {
      const res = await getSqlConnections(currentTeam.id);
      setConnections(res.connections);
    } catch {
      toast.error('Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam, toast]);

  useEffect(() => {
    if (!currentTeam || !user) return;
    loadConnections();
    getTeamMembers(currentTeam.id)
      .then((members) => {
        const me = members.find((m) => m.user_id === user.id);
        setIsAdmin(me?.role === 'owner' || me?.role === 'admin');
      })
      .catch(() => setIsAdmin(false));
  }, [currentTeam, user, loadConnections]);

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (conn: SqlConnectionResponse) => {
    setEditingId(conn.id);
    setForm({
      name: conn.name,
      host: '',
      port: conn.port,
      database_name: '',
      username: '',
      password: '',
      ssl_required: conn.ssl_required,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!currentTeam) return;
    if (!form.name.trim() || (!editingId && (!form.host.trim() || !form.database_name.trim() || !form.username.trim()))) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const payload: Record<string, unknown> = { name: form.name, ssl_required: form.ssl_required };
        if (form.host) payload.host = form.host;
        if (form.port) payload.port = form.port;
        if (form.database_name) payload.database_name = form.database_name;
        if (form.username) payload.username = form.username;
        if (form.password) payload.password = form.password;
        await updateSqlConnection(currentTeam.id, editingId, payload as Parameters<typeof updateSqlConnection>[2]);
        toast.success('Connection updated');
      } else {
        await createSqlConnection(currentTeam.id, {
          name: form.name,
          host: form.host,
          port: form.port,
          database_name: form.database_name,
          username: form.username,
          password: form.password,
          ssl_required: form.ssl_required,
        });
        toast.success('Connection created');
      }
      closeForm();
      loadConnections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save connection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (connId: string) => {
    if (!currentTeam) return;
    if (!confirm('Delete this connection? Charts using it will lose their data source.')) return;
    try {
      await deleteSqlConnection(currentTeam.id, connId);
      toast.success('Connection deleted');
      setConnections((prev) => prev.filter((c) => c.id !== connId));
    } catch {
      toast.error('Failed to delete connection');
    }
  };

  const handleTest = async (connId: string) => {
    if (!currentTeam) return;
    setTestingId(connId);
    try {
      const result = await testSqlConnection(currentTeam.id, connId);
      if (result.status === 'ok') {
        toast.success('Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
      loadConnections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  if (!currentTeam) {
    return (
      <div className="settings-empty">
        <Database size={48} className="settings-empty__icon" />
        <p className="settings-empty__text">No team selected</p>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h1 className="settings-section__title">Database Connections</h1>
        <p className="settings-section__description">
          Connect PostgreSQL databases to create live SQL-powered charts.
        </p>
      </div>

      {isAdmin && !showForm && (
        <div style={{ marginBottom: '16px' }}>
          <Button variant="primary" onClick={openAddForm}>
            <Plus size={16} />
            Add Connection
          </Button>
        </div>
      )}

      {showForm && (
        <div className="settings-card conn-form">
          <div className="settings-card__header">
            <h3 className="settings-card__title">
              {editingId ? 'Edit Connection' : 'New Connection'}
            </h3>
            <button className="conn-form-close" onClick={closeForm} aria-label="Close form">
              <X size={18} />
            </button>
          </div>
          <div className="settings-card__content">
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="conn-name">Name *</label>
              <input
                id="conn-name"
                type="text"
                className="settings-field__input"
                placeholder="Production DB"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="conn-form-row">
              <div className="settings-field" style={{ flex: 2 }}>
                <label className="settings-field__label" htmlFor="conn-host">
                  Host {!editingId && '*'}
                </label>
                <input
                  id="conn-host"
                  type="text"
                  className="settings-field__input"
                  placeholder={editingId ? '(unchanged)' : 'db.example.com'}
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </div>
              <div className="settings-field" style={{ flex: 0, minWidth: '90px' }}>
                <label className="settings-field__label" htmlFor="conn-port">Port</label>
                <input
                  id="conn-port"
                  type="number"
                  className="settings-field__input"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 5432 })}
                />
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="conn-db">
                Database {!editingId && '*'}
              </label>
              <input
                id="conn-db"
                type="text"
                className="settings-field__input"
                placeholder={editingId ? '(unchanged)' : 'my_database'}
                value={form.database_name}
                onChange={(e) => setForm({ ...form, database_name: e.target.value })}
              />
            </div>
            <div className="conn-form-row">
              <div className="settings-field" style={{ flex: 1 }}>
                <label className="settings-field__label" htmlFor="conn-user">
                  Username {!editingId && '*'}
                </label>
                <input
                  id="conn-user"
                  type="text"
                  className="settings-field__input"
                  placeholder={editingId ? '(unchanged)' : 'readonly_user'}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="settings-field" style={{ flex: 1 }}>
                <label className="settings-field__label" htmlFor="conn-pass">
                  Password {!editingId && '*'}
                </label>
                <input
                  id="conn-pass"
                  type="password"
                  className="settings-field__input"
                  placeholder={editingId ? '(unchanged)' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <label className="conn-form-checkbox">
              <input
                type="checkbox"
                checked={form.ssl_required}
                onChange={(e) => setForm({ ...form, ssl_required: e.target.checked })}
              />
              <span>Require SSL</span>
            </label>
            <p className="settings-muted-text">
              We recommend using a read-only database user for security.
            </p>
            <div className="conn-form-actions">
              <Button variant="default" onClick={closeForm}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="settings-empty">Loading...</div>
      ) : connections.length === 0 ? (
        <div className="settings-card">
          <div className="settings-empty">
            <Database size={48} className="settings-empty__icon" />
            <p className="settings-empty__text">
              {isAdmin
                ? 'No connections yet. Add one to start creating SQL-powered charts.'
                : 'No database connections configured. Ask a team admin to add one.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="conn-list">
          {connections.map((conn) => (
            <div key={conn.id} className="settings-card conn-item">
              <div className="conn-item-header">
                <div className="conn-item-info">
                  <div className="conn-item-name">
                    <Database size={16} />
                    <span>{conn.name}</span>
                    <span className={`conn-status conn-status--${conn.status}`}>
                      {conn.status}
                    </span>
                  </div>
                  <div className="conn-item-detail">
                    {conn.host_masked}:{conn.port}/{conn.database_name_masked}
                    &nbsp;&middot;&nbsp;{conn.username_masked}
                  </div>
                </div>
                {isAdmin && (
                  <div className="conn-item-actions">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleTest(conn.id)}
                      disabled={testingId === conn.id}
                      title="Test connection"
                      aria-label="Test connection"
                    >
                      <Zap size={14} />
                      {testingId === conn.id ? 'Testing...' : 'Test'}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openEditForm(conn)}
                      title="Edit connection"
                      aria-label="Edit connection"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(conn.id)}
                      title="Delete connection"
                      aria-label="Delete connection"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
              {conn.status === 'error' && conn.status_message && (
                <div className="conn-item-error">{conn.status_message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
