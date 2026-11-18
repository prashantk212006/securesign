
import { useEffect, useState } from 'react';
import {
  FileText,
  Send,
  Plus,
  ArrowRight,
  Activity,
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard({ onNavigate, role }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isSuperAdmin = role === 'super_admin';

  useEffect(() => {
    let active = true;

    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await api.get('/documents/');
        const documentList = Array.isArray(response.data)
          ? response.data
          : [];

        const enrichedDocuments = await Promise.all(
          documentList.map(async (doc) => {
            let signerName = '—';

            if (doc.status === 'Signed') {
              try {
                const signatureResponse = await api.get(
                  `/signatures/document/${doc.id}`
                );

                const signatures = Array.isArray(signatureResponse.data)
                  ? signatureResponse.data
                  : [];

                signerName =
                  signatures[0]?.signer_name || 'Signed';
              } catch {
                signerName = 'Signed';
              }
            }

            return {
              ...doc,
              displayName:
                doc.title && doc.title !== 'string'
                  ? doc.title
                  : doc.filename || `Document ${doc.id}`,
              client: signerName,
              date: doc.created_at
                ? new Date(doc.created_at).toLocaleDateString()
                : '—',
            };
          })
        );

        if (active) {
          setDocuments(enrichedDocuments);
        }
      } catch (err) {
        console.error('Dashboard document loading error:', err);

        if (active) {
          setError(
            err.response?.status === 401
              ? 'Your session has expired. Please log in again.'
              : 'Could not load documents. Check your backend connection.'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      active = false;
    };
  }, []);

  const statusStyle = {
    Signed: 'bg-green-100 text-green-700',
    Pending: 'bg-orange-100 text-orange-700',
    Rejected: 'bg-red-100 text-red-700',
  };

  const signedCount = documents.filter(
    (doc) => doc.status === 'Signed'
  ).length;

  const pendingCount = documents.filter(
    (doc) => doc.status === 'Pending'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Overview
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {isSuperAdmin
              ? 'Monitor document signing activity across all administrators.'
              : 'Monitor your document signing activity.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('send')}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Send Document
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <FileText size={23} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Total Documents
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {loading ? '...' : documents.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <Activity size={23} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Signed Documents
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {loading ? '...' : signedCount}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
              <FileText size={23} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Pending Documents
              </p>

              <p className="text-2xl font-bold text-slate-900">
                {loading ? '...' : pendingCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <FileText size={23} />
            </div>

            <h3 className="font-semibold text-slate-800">
              Document Management
            </h3>
          </div>

          <p className="text-sm leading-6 text-slate-500">
            Upload PDF documents and prepare signing invitations for your clients.
          </p>

          <button
            onClick={() => onNavigate('send')}
            className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            Send a document <ArrowRight size={16} />
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <Activity size={23} />
            </div>

            <h3 className="font-semibold text-slate-800">
              Signing Activity
            </h3>
          </div>

          <p className="text-sm leading-6 text-slate-500">
            Review document activity and signing records from your connected backend.
          </p>

          <button
            onClick={() => onNavigate('history')}
            className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            View history <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Recent Documents
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Latest document activity
            </p>
          </div>

          <button
            onClick={() => onNavigate('history')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
          >
            View all
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Document</th>

                {isSuperAdmin && (
                  <th className="px-6 py-4">Owner / Admin</th>
                )}

                <th className="px-6 py-4">Signer</th>
                <th className="px-6 py-4">Date sent</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 5 : 4}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 5 : 4}
                    className="px-6 py-16 text-center"
                  >
                    <FileText
                      size={42}
                      className="mx-auto mb-4 text-slate-300"
                    />

                    <h3 className="font-semibold text-slate-700">
                      No documents yet
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      Documents will appear here after they are uploaded.
                    </p>

                    <button
                      onClick={() => onNavigate('send')}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100"
                    >
                      <Send size={16} /> Prepare a document
                    </button>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-slate-100">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {doc.displayName}
                    </td>

                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="font-medium text-slate-800">
                          {doc.owner_name || 'Unknown Admin'}
                        </div>

                        <div className="text-xs text-slate-500">
                          {doc.owner_email || ''}
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {doc.client}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {doc.date}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          statusStyle[doc.status] ||
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {doc.status || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
