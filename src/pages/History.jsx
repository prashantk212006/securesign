
import { useEffect, useState } from 'react';
import {
  Search,
  FileText,
  Download,
  Eye,
  Trash2,
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  RefreshCw,
  AlertTriangle,
  Timer,
} from 'lucide-react';

import api from '../services/api';

export default function History({ onBack }) {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  // Load document history from the backend.
  const loadHistory = async () => {
    try {
      setError('');
      const response = await api.get('/documents/history');
      setRecords(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Unable to load document history.'
      );
    } finally {
      setIsLoading(false);
      setIsResetting(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Determine the current document status.
  const getDocumentStatus = (record) => {
    // These statuses must take priority over expiry calculations.
    if (
      record.status === 'Signed' ||
      record.status === 'Rejected' ||
      record.status === 'Terminated'
    ) {
      return record.status;
    }

    if (record.expires_at) {
      const remaining =
        new Date(record.expires_at).getTime() - Date.now();

      if (remaining <= 0) return 'Expired';

      if (remaining <= 2 * 60 * 60 * 1000) {
        return 'Expiring Soon';
      }
    }

    return record.status || 'Pending';
  };

  // Format dates in DD/MM/YYYY format.
  const formatDate = (date) => {
    if (!date) return '—';

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '—';
    }

    return parsedDate.toLocaleString('en-GB');
  };

  // Display the remaining invitation time.
  const getExpiryMessage = (expiresAt) => {
    if (!expiresAt) return 'Not available';

    const remaining =
      new Date(expiresAt).getTime() - Date.now();

    if (Number.isNaN(remaining)) {
      return 'Invalid date';
    }

    if (remaining <= 0) {
      return 'Link expired';
    }

    const hours = Math.floor(
      remaining / (60 * 60 * 1000)
    );

    const minutes = Math.floor(
      (remaining % (60 * 60 * 1000)) / (60 * 1000)
    );

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes}m remaining`;
  };

  // Reset search and status filters.
  const handleReset = () => {
    setSearch('');
    setStatus('All');
    setIsResetting(true);
    loadHistory();
  };

  // Hide a document from History only.
  // The original document remains available on Dashboard.
  const handleHideFromHistory = async (record) => {
    try {
      setError('');

      await api.patch(
        `/documents/${record.id}/hide-from-history`
      );

      setRecords((previousRecords) =>
        previousRecords.filter(
          (item) => item.id !== record.id
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Unable to remove document from History.'
      );
    }
  };

  // View or download a document.
  const openDocument = async (record, action) => {
    try {
      setError('');

      const endpoint =
        action === 'download'
          ? `/signatures/document/${record.id}/signed-download`
          : `/documents/${record.id}/view`;

      const response = await api.get(endpoint, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data);

      if (action === 'download') {
        const link = document.createElement('a');

        link.href = url;
        link.download = `${record.title || 'document'}.pdf`;

        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const link = document.createElement('a');

        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Unable to open this document.'
      );
    }
  };

  // Add display information to each record.
  const enrichedRecords = records.map((record) => ({
    ...record,
    currentStatus: getDocumentStatus(record),

    client:
      record.signer_name ||
      record.recipient_email ||
      'Not sent',

    email: record.recipient_email || '—',
    name: record.title,
    sent: record.sent_at,
    signed: record.signed_at,
    expiresAt: record.expires_at,
  }));

  // Search and status filtering.
  const filteredRecords = enrichedRecords.filter((record) => {
    const query = search.toLowerCase();

    const matchesSearch =
      (record.client || '').toLowerCase().includes(query) ||
      (record.name || '').toLowerCase().includes(query) ||
      (record.email || '').toLowerCase().includes(query);

    const matchesStatus =
      status === 'All' || record.currentStatus === status;

    return matchesSearch && matchesStatus;
  });

  // Status badge colors.
  const statusStyle = {
    Signed: 'bg-green-100 text-green-700',
    Pending: 'bg-orange-100 text-orange-700',
    'Expiring Soon': 'bg-amber-100 text-amber-700',
    Expired: 'bg-red-100 text-red-700',
    Terminated: 'bg-red-100 text-red-700',
    Rejected: 'bg-slate-200 text-slate-700',
  };

  // Summary cards.
  const summary = [
    {
      label: 'Signed',
      count: enrichedRecords.filter(
        (r) => r.currentStatus === 'Signed'
      ).length,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Pending',
      count: enrichedRecords.filter(
        (r) => r.currentStatus === 'Pending'
      ).length,
      icon: Clock,
      color: 'text-orange-600 bg-orange-50',
    },
    {
      label: 'Expiring Soon',
      count: enrichedRecords.filter(
        (r) => r.currentStatus === 'Expiring Soon'
      ).length,
      icon: Timer,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Terminated',
      count: enrichedRecords.filter(
        (r) => r.currentStatus === 'Terminated'
      ).length,
      icon: XCircle,
      color: 'text-red-600 bg-red-50',
    },
    {
      label: 'Expired',
      count: enrichedRecords.filter(
        (r) => r.currentStatus === 'Expired'
      ).length,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">

        {/* Back button */}
        <button
          onClick={onBack}
          className="mb-7 flex items-center gap-2 text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Document History
            </h1>

            <p className="mt-2 text-slate-500">
              Monitor document signing activity and invitation expiry.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
            <FileText className="text-blue-600" size={23} />

            <div>
              <p className="text-xs text-slate-500">
                Total records
              </p>

              <p className="text-lg font-bold">
                {records.length}
              </p>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
          {summary.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.color}`}
                >
                  <Icon size={22} />
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {item.label} Documents
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {item.count}
                </p>
              </div>
            );
          })}
        </div>

        {/* Invitation expiry information */}
        <div className="mb-7 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Timer
            className="mt-0.5 shrink-0 text-blue-600"
            size={21}
          />

          <div>
            <p className="font-semibold text-blue-900">
              Time-limited signing invitations
            </p>

            <p className="mt-1 text-sm text-blue-800">
              Signing invitations expire after 24 hours.
              Documents not signed within this period are marked as Terminated.
            </p>
          </div>
        </div>

        {/* History table container */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {/* Search and filters */}
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">
                All Documents
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search and filter document records.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              {/* Search */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents or clients"
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 sm:w-64"
                />
              </div>

              {/* Status filter */}
              <div className="relative">
                <Filter
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={17}
                />

                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-8 text-sm outline-none focus:border-blue-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Signed">Signed</option>
                  <option value="Pending">Pending</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition-all duration-200 hover:bg-slate-50 disabled:opacity-70"
              >
                <RefreshCw
                  size={16}
                  className={isResetting ? 'animate-spin' : ''}
                />

                {isResetting ? 'Refreshing...' : 'Reset'}
              </button>
            </div>
          </div>

          {/* Documents table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">

              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Document</th>
                  <th className="px-6 py-4">Client Details</th>
                  <th className="px-6 py-4">Date Sent</th>
                  <th className="px-6 py-4">Date Signed</th>
                  <th className="px-6 py-4">Expires At</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50"
                  >

                    {/* Document name */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <FileText
                          className="shrink-0 text-blue-600"
                          size={21}
                        />

                        <span className="text-sm font-semibold">
                          {record.name}
                        </span>
                      </div>
                    </td>

                    {/* Client details */}
                    <td className="px-6 py-5">
                      <p className="text-sm font-semibold">
                        {record.client}
                      </p>

                      <p className="text-xs text-slate-500">
                        {record.email}
                      </p>
                    </td>

                    {/* Date sent */}
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {formatDate(record.sent)}
                    </td>

                    {/* Date signed */}
                    <td className="px-6 py-5 text-sm text-slate-500">
                      {formatDate(record.signed)}
                    </td>

                    {/* Expiry date */}
                    <td className="px-6 py-5">
                      <p className="text-sm text-slate-700">
                        {formatDate(record.expiresAt)}
                      </p>

                      {(record.currentStatus === 'Pending' ||
                        record.currentStatus === 'Expiring Soon') && (
                        <p
                          className={`mt-1 text-xs ${
                            record.currentStatus === 'Expiring Soon'
                              ? 'font-semibold text-amber-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {getExpiryMessage(record.expiresAt)}
                        </p>
                      )}

                      {record.currentStatus === 'Terminated' && (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          Invitation expired
                        </p>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
                          statusStyle[record.currentStatus] ||
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {record.currentStatus === 'Expiring Soon' && (
                          <AlertTriangle size={13} />
                        )}

                        {record.currentStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">

                        {/* View document */}
                        <button
                          type="button"
                          title="View document"
                          onClick={() => openDocument(record, 'view')}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye size={19} />
                        </button>

                        {/* Download signed document */}
                        {record.currentStatus === 'Signed' && (
                          <button
                            type="button"
                            title="Download document"
                            onClick={() =>
                              openDocument(record, 'download')
                            }
                            className="text-green-600 hover:text-green-800"
                          >
                            <Download size={19} />
                          </button>
                        )}

                        {/* Hide from History */}
                        <button
                          type="button"
                          title="Remove from History"
                          onClick={() =>
                            handleHideFromHistory(record)
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={19} />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}

                {/* Loading state */}
                {isLoading && (
                  <tr>
                    <td
                      colSpan="7"
                      className="py-16 text-center text-slate-500"
                    >
                      Loading document history...
                    </td>
                  </tr>
                )}

                {/* Empty state */}
                {!isLoading && filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <FileText
                        size={42}
                        className="mx-auto mb-4 text-slate-300"
                      />

                      <h3 className="font-semibold text-slate-700">
                        {records.length === 0
                          ? 'No documents found'
                          : 'No matching documents found'}
                      </h3>

                      <p className="mt-2 text-sm text-slate-500">
                        {records.length === 0
                          ? 'Documents will appear here after they are uploaded.'
                          : 'Try changing your search or status filter.'}
                      </p>
                    </td>
                  </tr>
                )}

              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
            Showing {filteredRecords.length} of {records.length} records
          </div>

        </div>
      </div>
    </div>
  );
}
