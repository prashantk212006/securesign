
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  User,
  Clock,
  Hash,
  CheckCircle,
  Upload,
  Mail,
  PenLine,
  Copy,
  AlertCircle
} from 'lucide-react';

export default function AuditTrail({
  document = null,
  auditData = null,
  onBack
}) {
  const activities = auditData?.activities || [];

  const auditItems = [
    {
      label: 'Document uploaded',
      icon: Upload,
      description: 'Document upload event',
      date: auditData?.uploadedAt
    },
    {
      label: 'Invitation sent',
      icon: Mail,
      description: 'Signing invitation event',
      date: auditData?.invitationSentAt
    },
    {
      label: 'Document signed',
      icon: PenLine,
      description: 'Signature submission event',
      date: auditData?.signedAt
    }
  ];

  const formatDate = (value) => {
    if (!value) return 'Not available';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Not available';

    return date.toLocaleString();
  };

  const copyHash = async (value) => {
    if (value && navigator.clipboard) {
      await navigator.clipboard.writeText(value);
    }
  };

  const documentName = document?.name || document?.title || 'Document details unavailable';
  const documentId = document?.id || 'Not available';
  const status = document?.status || 'Not available';

  const originalHash = auditData?.originalHash;
  const finalHash = auditData?.finalDocumentHash;

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-10">
      <div className="max-w-6xl mx-auto">

        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-7 transition"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 p-3 rounded-xl">
                <ShieldCheck size={25} />
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                  Audit Trail
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Document activity and integrity information
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3">
            <p className="text-xs text-slate-500">Document status</p>
            <p className="font-semibold text-slate-800 mt-1">
              {status}
            </p>
          </div>
        </div>

        {/* Document details */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" size={22} />
            <h2 className="font-bold text-lg">Document Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-1">Document name</p>
              <p className="font-semibold text-slate-800 break-all">
                {documentName}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Document ID</p>
              <p className="font-semibold text-slate-800 break-all">
                {documentId}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Date uploaded</p>
              <p className="font-medium text-slate-800">
                {formatDate(auditData?.uploadedAt)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Current status</p>
              <p className="font-medium text-slate-800">{status}</p>
            </div>
          </div>
        </section>

        {/* Signer details */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-blue-600" size={22} />
            <h2 className="font-bold text-lg">Signer Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-500 mb-1">Signer name</p>
              <p className="font-semibold text-slate-800">
                {auditData?.signerName || 'Not available'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Signer email</p>
              <p className="font-semibold text-slate-800 break-all">
                {auditData?.signerEmail || 'Not available'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Signing date</p>
              <p className="font-medium text-slate-800">
                {formatDate(auditData?.signedAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Activity timeline */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-7">
            <Clock className="text-blue-600" size={22} />
            <h2 className="font-bold text-lg">Activity Timeline</h2>
          </div>

          {activities.length > 0 ? (
            <div className="space-y-6">
              {activities.map((activity, index) => (
                <div key={activity.id || index} className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CheckCircle size={20} />
                  </div>

                  <div className="flex-1 border-b border-slate-100 pb-5">
                    <p className="font-semibold text-slate-800">
                      {activity.action || 'Activity recorded'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {activity.description || 'No additional details'}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {formatDate(activity.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Clock size={35} className="mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-700">
                No activity records available
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Activity will appear here when the backend provides audit events.
              </p>
            </div>
          )}
        </section>

        {/* Document integrity */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <Hash className="text-blue-600" size={22} />
            <h2 className="font-bold text-lg">Document Integrity</h2>
          </div>

          <p className="text-sm text-slate-500 mb-6">
            SHA-256 hashes can help verify whether the original and signed
            documents have changed.
          </p>

          <div className="space-y-5">
            {[
              { label: 'Original document hash', value: originalHash },
              { label: 'Final signed document hash', value: finalHash }
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  {item.label}
                </p>

                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500 break-all flex-1 font-mono">
                    {item.value || 'Hash not provided by backend'}
                  </p>

                  {item.value && (
                    <button
                      onClick={() => copyHash(item.value)}
                      title="Copy hash"
                      className="text-blue-600 hover:text-blue-800 shrink-0"
                    >
                      <Copy size={17} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Verification not available
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Document verification will be displayed when the backend
                provides the required hashes and verification result.
              </p>
            </div>
          </div>
        </section>

        <p className="text-xs text-center text-slate-400 mt-7">
          SecureSign · Document Audit Information
        </p>

      </div>
    </div>
  );
}
