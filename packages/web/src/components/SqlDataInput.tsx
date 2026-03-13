import { useState, useEffect, useCallback } from 'react';
import Play from 'lucide-react/dist/esm/icons/play';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import {
  getSqlConnections,
  querySqlConnection,
  type SqlConnectionResponse,
  type SqlQueryResponse,
} from '../services/api';
import { useTeam } from '../contexts/TeamContext';
import { SqlQueryEditor } from './SqlQueryEditor';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';
import type { ChartData } from '../types';
import './SqlDataInput.css';

interface SqlDataInputProps {
  onSubmit: (data: ChartData) => void;
  isProcessing: boolean;
}

export function SqlDataInput({ onSubmit, isProcessing }: SqlDataInputProps) {
  const { currentTeam } = useTeam();
  const [connections, setConnections] = useState<SqlConnectionResponse[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<SqlQueryResponse | null>(null);
  const [labelColumn, setLabelColumn] = useState('');
  const [seriesColumns, setSeriesColumns] = useState<string[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);

  // Fetch connections
  useEffect(() => {
    if (!currentTeam) return;
    setIsLoadingConnections(true);
    getSqlConnections(currentTeam.id)
      .then((res) => {
        setConnections(res.connections);
        if (res.connections.length > 0) {
          setSelectedConnectionId(res.connections[0].id);
        }
      })
      .catch(() => setConnections([]))
      .finally(() => setIsLoadingConnections(false));
  }, [currentTeam]);

  const handleRunQuery = useCallback(async () => {
    if (!currentTeam || !selectedConnectionId || !sqlQuery.trim()) return;
    setIsQuerying(true);
    setError(null);
    setQueryResult(null);

    try {
      const result = await querySqlConnection(currentTeam.id, selectedConnectionId, {
        sql: sqlQuery,
        label_column: labelColumn || undefined,
        series_columns: seriesColumns.length > 0 ? seriesColumns : undefined,
      });
      setQueryResult(result);

      // Auto-detect column mapping from result
      if (result.columns.length > 0 && !labelColumn) {
        setLabelColumn(result.chart_data.labels.length > 0 ? result.columns[0] : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsQuerying(false);
    }
  }, [currentTeam, selectedConnectionId, sqlQuery, labelColumn, seriesColumns]);

  const handleCreateChart = useCallback(() => {
    if (!queryResult) return;
    const chartData = queryResult.chart_data;

    onSubmit({
      labels: chartData.labels,
      series: chartData.series,
      sourceType: 'sql',
      suggestedType: chartData.series.length === 1 ? 'bar' : 'line',
      suggestedTitle: 'SQL Query Result',
      sqlConnectionId: selectedConnectionId,
      sqlQuery,
      sqlLabelColumn: labelColumn || undefined,
      sqlSeriesColumns: seriesColumns.length > 0 ? seriesColumns : undefined,
    });
  }, [queryResult, onSubmit, selectedConnectionId, sqlQuery, labelColumn, seriesColumns]);

  if (isLoadingConnections) {
    return <div className="sql-input-loading"><LoadingSpinner /></div>;
  }

  if (connections.length === 0) {
    return (
      <div className="sql-input-empty">
        <AlertCircle size={24} />
        <p>No database connections configured.</p>
        <p className="sql-input-empty-hint">
          Go to Settings &gt; Connections to add a PostgreSQL connection.
        </p>
      </div>
    );
  }

  return (
    <div className="sql-input">
      <div className="sql-input-connection">
        <label className="sql-input-label" htmlFor="sql-conn">Connection</label>
        <select
          id="sql-conn"
          className="sql-input-select"
          value={selectedConnectionId}
          onChange={(e) => setSelectedConnectionId(e.target.value)}
        >
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.host_masked}:{c.port}/{c.database_name_masked})
              {c.status === 'error' ? ' ⚠' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="sql-input-query">
        <label className="sql-input-label">SQL Query</label>
        <SqlQueryEditor value={sqlQuery} onChange={setSqlQuery} />
      </div>

      <div className="sql-input-actions">
        <Button
          variant="primary"
          onClick={handleRunQuery}
          disabled={isQuerying || !sqlQuery.trim() || isProcessing}
        >
          <Play size={14} />
          <span>{isQuerying ? 'Running...' : 'Run Query'}</span>
        </Button>
      </div>

      {error && (
        <div className="sql-input-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {queryResult && (
        <div className="sql-input-results">
          <div className="sql-input-results-header">
            <span className="sql-input-results-count">{queryResult.row_count} rows</span>
          </div>

          <div className="sql-input-mapping">
            <div className="sql-input-mapping-field">
              <label className="sql-input-label" htmlFor="label-col">Label Column</label>
              <select
                id="label-col"
                className="sql-input-select"
                value={labelColumn}
                onChange={(e) => {
                  setLabelColumn(e.target.value);
                }}
              >
                <option value="">Auto-detect</option>
                {queryResult.columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
            <div className="sql-input-mapping-field">
              <label className="sql-input-label" htmlFor="series-cols">Series Columns</label>
              <select
                id="series-cols"
                className="sql-input-select"
                multiple
                value={seriesColumns}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                  setSeriesColumns(selected);
                }}
              >
                {queryResult.columns.filter((c) => c !== labelColumn).map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview table */}
          <div className="sql-input-preview">
            <table className="sql-input-table">
              <thead>
                <tr>
                  {queryResult.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {queryResult.columns.map((col) => (
                      <td key={col}>{String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {queryResult.rows.length > 10 && (
              <div className="sql-input-preview-more">
                Showing 10 of {queryResult.row_count} rows
              </div>
            )}
          </div>

          <div className="sql-input-submit">
            <Button variant="primary" onClick={handleCreateChart} disabled={isProcessing}>
              Create Chart
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
