
import { useEffect, useState } from 'react';
import {
  ClipboardList,
  RefreshCw,
  FileText,
  Clock,
  Pencil,
  AlertCircle,
} from 'lucide-react';

import api from '../services/api';

export default function PendingRequests({ onBack, onResume, role }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/documents/pending-requests');
      setRequests(response.data || []);
    } catch (err) {
      console.error('Pending Requests Error:', err);
      setError(
        err.response?.data?.detail ||
        'Unable to load pending requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const formatDate = (date) => {
    if (!date) return 'Not available';

    return new Date(date).toLocaleString();
  };

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
                <ClipboardList size={25} />
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                Pending Requests
              </h2>
            </div>

            <p className="text-slate-500">
              View unfinished drafts and outstanding signing requests.
            </p>
          </div>

          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              Loading pending requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center">
              <FileText
                size={42}
                className="mx-auto text-slate-300 mb-4"
              />
              <h3 className="font-semibold text-slate-800">
                No Pending Requests
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                Unfinished drafts and outstanding invitations will appear here.
              </p>
              <button
                onClick={onBack}
                className="mt-5 text-blue-600 font-semibold hover:underline"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-xs font-semibold text-slate-500">Document</th>
                    <th className="p-4 text-xs font-semibold text-slate-500">Recipient</th>
                    <th className="p-4 text-xs font-semibold text-slate-500">Status</th>
                    <th className="p-4 text-xs font-semibold text-slate-500">Last Updated</th>
                    {role === 'super_admin' && (
                      <th className="p-4 text-xs font-semibold text-slate-500">Owner</th>
                    )}
                    <th className="p-4 text-xs font-semibold text-slate-500">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {requests.map((item) => {
                    const isDraft = item.status === 'Draft';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <p className="font-semibold text-slate-800">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            ID: {item.id}
                          </p>
                        </td>

                        <td className="p-4">
                          <p className="text-sm text-slate-700">
                            {item.recipient_name || 'Not specified'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.recipient_email || 'No email'}
                          </p>
                        </td>

                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            isDraft
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {isDraft ? 'Draft' : 'Invitation Pending'}
                          </span>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.workflow_stage || 'uploaded'}
                          </p>
                        </td>

                        <td className="p-4 text-sm text-slate-600">
                          {formatDate(item.draft_saved_at || item.sent_at || item.created_at)}
                        </td>

                        {role === 'super_admin' && (
                          <td className="p-4 text-sm text-slate-600">
                            {item.owner_name || 'Unknown'}
                          </td>
                        )}

                        <td className="p-4">
                          {isDraft ? (
                            <button
                              onClick={() => onResume(item.id)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                            >
                              <Pencil size={15} />
                              Resume
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock size={14} />
                              Awaiting signature
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
