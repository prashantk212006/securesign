
import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
  Power,
  PowerOff,
} from 'lucide-react';

import api from '../services/api';

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Load all administrator accounts.
  const loadAdmins = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/auth/admins');
      setAdmins(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Unable to load administrator accounts.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Create a new regular administrator.
  const handleCreateAdmin = async (e) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setCreating(true);

    try {
      const response = await api.post('/auth/admins', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      setSuccess(
        response.data.message ||
          'Administrator created successfully.'
      );

      setForm({
        name: '',
        email: '',
        password: '',
      });

      await loadAdmins();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Unable to create administrator account.'
      );
    } finally {
      setCreating(false);
    }
  };

  // Activate or deactivate a regular administrator.
  const handleToggleStatus = async (admin) => {
    const currentlyActive = admin.is_active !== false &&
      admin.is_active !== 0;

    const action = currentlyActive ? 'deactivate' : 'activate';

    const confirmed = window.confirm(
      currentlyActive
        ? `Are you sure you want to deactivate ${admin.name}? They will no longer be able to access SecureSign.`
        : `Are you sure you want to reactivate ${admin.name}?`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');
    setUpdatingId(admin.id);

    try {
      const response = await api.patch(
        `/auth/admins/${admin.id}/${action}`
      );

      setSuccess(
        response.data.message ||
          `Administrator ${action}d successfully.`
      );

      await loadAdmins();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          `Unable to ${action} administrator.`
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = admins.filter(
    (admin) =>
      admin.is_active !== false && admin.is_active !== 0
  ).length;

  const inactiveCount = admins.length - activeCount;

  return (
    <div className="space-y-8 p-6 md:p-8">

      {/* Page heading */}
      <div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-600">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Admin Management
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create and manage SecureSign administrator accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Account summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total Administrators
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {admins.length}
          </p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Active Accounts
          </p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Inactive Accounts
          </p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* Create administrator form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <UserPlus size={21} />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Create New Administrator
            </h3>

            <p className="text-sm text-slate-500">
              Only the Super Admin can create administrator accounts.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateAdmin} className="space-y-5">

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Full Name
            </label>

            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Enter administrator name"
                required
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email Address
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="admin@example.com"
                required
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
                className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <p className="mt-1 text-xs text-slate-400">
              Use at least 8 characters.
            </p>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus size={18} />
            {creating ? 'Creating Account...' : 'Create Administrator'}
          </button>

        </form>
      </div>

      {/* Administrator list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users size={21} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Administrator Accounts
              </h3>

              <p className="text-sm text-slate-500">
                {admins.length} account(s) registered
              </p>
            </div>
          </div>

          <button
            onClick={loadAdmins}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-500">
            Loading administrator accounts...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No administrator accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">

              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    Administrator
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Email
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Role
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Created
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {admins.map((admin) => {
                  const isSuperAdmin = admin.role === 'super_admin';

                  const isActive =
                    admin.is_active !== false &&
                    admin.is_active !== 0;

                  const isUpdating = updatingId === admin.id;

                  return (
                    <tr
                      key={admin.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                            {admin.name?.charAt(0)?.toUpperCase() || 'A'}
                          </div>

                          <div>
                            <p className="font-medium text-slate-900">
                              {admin.name}
                            </p>

                            <p className="text-xs text-slate-400">
                              ID: {admin.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {admin.email}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            isSuperAdmin
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isSuperAdmin ? 'Super Admin' : 'Admin'}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {admin.created_at
                          ? new Date(admin.created_at).toLocaleDateString('en-IN')
                          : '—'}
                      </td>

                      <td className="px-6 py-4">
                        {isSuperAdmin ? (
                          <span className="text-xs font-medium text-slate-400">
                            Protected account
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleStatus(admin)}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              isActive
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                            }`}
                          >
                            {isUpdating ? (
                              <RefreshCw
                                size={16}
                                className="animate-spin"
                              />
                            ) : isActive ? (
                              <PowerOff size={16} />
                            ) : (
                              <Power size={16} />
                            )}

                            {isUpdating
                              ? 'Updating...'
                              : isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
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
  );
}
